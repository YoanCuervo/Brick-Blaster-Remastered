import {
  type DifficultyId,
  type GameEndKind,
  type GameRow,
  KEPT_RANKS,
  type Leaderboard,
  type LeaderboardEntry,
  PROFILE_GAMES,
  type PerDifficulty,
  type PlayerCard,
  type Profile,
  SHOWN_RANKS,
  TICKS_PER_SECOND,
  WORLD_IDS,
  type WorldId,
} from "@brick-blaster/contracts";
import type mysql from "mysql2/promise";

/** What the game routes need from the database: a test stands in for it in memory. */
export interface GameStore {
  createTrial(idHash: Buffer, expiresAt: Date): Promise<void>;
  /** Its game goes with it. */
  deleteTrial(idHash: Buffer): Promise<void>;
  /** True while the trial exists and has not expired. */
  isLiveTrial(idHash: Buffer, now: Date): Promise<boolean>;
  /**
   * A player plays one game at a time: the account's games still 'started' are dropped. Null
   * when the trial already has its game.
   */
  startGame(owner: GameOwner, game: NewGame): Promise<number | null>;
  findGame(id: number): Promise<StoredGame | null>;
  /** A game whose log was refused: nothing of it is kept. */
  dropGame(id: number): Promise<void>;
  /**
   * Writes the replay's result, then the player's counters and the leaderboard. The log is kept
   * only when the game enters the kept ranks. Null when the game was no longer 'started'.
   */
  endGame(id: number, outcome: GameOutcome, log: Buffer): Promise<{ rank: number | null } | null>;
  /** At sign-up: the trial's ended game passes to the account, and the trial is gone. */
  claimTrial(trialHash: Buffer, userId: number): Promise<void>;

  profile(userId: number): Promise<Omit<Profile, "pseudo" | "pseudoChosen" | "avatar">>;
  leaderboard(difficulty: DifficultyId, userId: number | null): Promise<Leaderboard>;
  playerCard(pseudo: string, difficulty: DifficultyId): Promise<PlayerCard | null>;

  cleanup(cutoffs: GameCleanupCutoffs): Promise<void>;
}

export type GameOwner = { userId: number } | { trialHash: Buffer };

export interface NewGame {
  world: WorldId;
  difficulty: DifficultyId;
  ranked: boolean;
  seed: number;
  startedAt: Date;
}

export interface StoredGame extends NewGame {
  id: number;
  userId: number | null;
  trialHash: Buffer | null;
  status: "started" | GameEndKind;
}

export interface GameOutcome {
  kind: GameEndKind;
  score: number;
  level: number;
  durationTicks: number;
  bricksBroken: number;
  livesLost: number;
  endedAt: Date;
}

export interface GameCleanupCutoffs {
  /** Trials past their end. */
  now: Date;
  /** Games started before this and never sent are dropped. */
  startedBefore: Date;
}

type Row = mysql.RowDataPacket;
type Value = string | number | boolean | Date | Buffer | null;
type Queryable = mysql.Pool | mysql.PoolConnection;

const DIFFICULTIES: readonly DifficultyId[] = [0, 1, 2];
/** Scores of these ends enter the score tables; a game left with Esc does not. */
const SCORED = "status IN ('game_over', 'finished')";

const seconds = (ticks: number) => Math.round(ticks / TICKS_PER_SECOND);
const triple = <T>(f: (d: DifficultyId) => T): PerDifficulty<T> => [f(0), f(1), f(2)];

export function createMysqlGameStore(pool: mysql.Pool): GameStore {
  const rows = async (db: Queryable, sql: string, values: Value[]): Promise<Row[]> =>
    (await db.execute<Row[]>(sql, values))[0];
  const run = async (db: Queryable, sql: string, values: Value[]) =>
    (await db.execute<mysql.ResultSetHeader>(sql, values))[0];

  /** 1-based place of a kept entry: ties go to the earlier game. */
  const rankOf = async (db: Queryable, difficulty: number, gameId: number, score: number) => {
    const [row] = await rows(
      db,
      "SELECT COUNT(*) AS better FROM limbes_top WHERE difficulty = ? " +
        "AND (score > ? OR (score = ? AND game_id < ?))",
      [difficulty, score, score, gameId],
    );
    return Number(row!["better"]) + 1;
  };

  /** The player's best kept entry at a difficulty, with its place. */
  const bestEntry = async (db: Queryable, userId: number, difficulty: number) => {
    const [row] = await rows(
      db,
      "SELECT game_id, score FROM limbes_top WHERE user_id = ? AND difficulty = ? " +
        "ORDER BY score DESC, game_id LIMIT 1",
      [userId, difficulty],
    );
    if (!row) return null;
    const score = Number(row["score"]);
    return { score, rank: await rankOf(db, difficulty, Number(row["game_id"]), score) };
  };

  /** Ranked games played per player at a difficulty, left ones included. */
  const rankedCounts = async (userIds: number[], difficulty: number) => {
    const counts = new Map<number, number>();
    if (userIds.length === 0) return counts;
    const found = await rows(
      pool,
      `SELECT user_id, COUNT(*) AS n FROM games WHERE user_id IN (${userIds.map(() => "?").join(", ")}) ` +
        "AND world = 'limbes' AND ranked = TRUE AND difficulty = ? AND status <> 'started' " +
        "GROUP BY user_id",
      [...userIds, difficulty],
    );
    for (const r of found) counts.set(Number(r["user_id"]), Number(r["n"]));
    return counts;
  };

  /** Counters and best scores of the game's owner, inside the caller's transaction. */
  const addToPlayer = async (db: Queryable, userId: number, game: GameForPlayer) => {
    await run(
      db,
      "INSERT INTO player_stats (user_id, games_played, play_ticks, max_level, bricks_broken, " +
        "lives_lost) VALUES (?, 1, ?, ?, ?, ?) AS new ON DUPLICATE KEY UPDATE " +
        "games_played = player_stats.games_played + 1, " +
        "play_ticks = player_stats.play_ticks + new.play_ticks, " +
        "max_level = GREATEST(player_stats.max_level, new.max_level), " +
        "bricks_broken = player_stats.bricks_broken + new.bricks_broken, " +
        "lives_lost = player_stats.lives_lost + new.lives_lost",
      [userId, game.durationTicks, game.level, game.bricksBroken, game.livesLost],
    );
    if (game.kind === "left") return;
    await run(
      db,
      "INSERT INTO player_bests (user_id, world, difficulty, best_score) VALUES (?, ?, ?, ?) " +
        "AS new ON DUPLICATE KEY UPDATE " +
        "best_score = GREATEST(player_bests.best_score, new.best_score)",
      [userId, game.world, game.difficulty, game.score],
    );
  };

  /** Enters a ranked game, trims the difficulty back to KEPT_RANKS; null when it fell out. */
  const enterTop = async (
    db: mysql.PoolConnection,
    gameId: number,
    userId: number,
    difficulty: number,
    score: number,
  ) => {
    await run(
      db,
      "INSERT INTO limbes_top (game_id, user_id, difficulty, score) VALUES (?, ?, ?, ?)",
      [gameId, userId, difficulty, score],
    );
    // replay_logs goes with the rows deleted here (ON DELETE CASCADE).
    await run(
      db,
      "DELETE t FROM limbes_top t JOIN (SELECT game_id FROM limbes_top WHERE difficulty = ? " +
        `ORDER BY score DESC, game_id LIMIT ${KEPT_RANKS}, 18446744073709551615) AS out_of_top ` +
        "USING (game_id)",
      [difficulty],
    );
    const [kept] = await rows(db, "SELECT 1 FROM limbes_top WHERE game_id = ?", [gameId]);
    return kept ? rankOf(db, difficulty, gameId, score) : null;
  };

  /** One transaction on one connection; the leaderboard of a difficulty is also locked by name. */
  const transaction = async <T>(
    lock: string | null,
    work: (db: mysql.PoolConnection) => Promise<T>,
  ) => {
    const db = await pool.getConnection();
    try {
      if (lock) {
        const [got] = await rows(db, "SELECT GET_LOCK(?, 10) AS got", [lock]);
        if (Number(got!["got"]) !== 1) throw new Error(`lock ${lock} not taken`);
      }
      await db.beginTransaction();
      try {
        const result = await work(db);
        await db.commit();
        return result;
      } catch (error: unknown) {
        await db.rollback();
        throw error;
      }
    } finally {
      if (lock) await db.query("SELECT RELEASE_LOCK(?)", [lock]).catch(() => {});
      db.release();
    }
  };

  const toGame = (row: Row): StoredGame => ({
    id: Number(row["id"]),
    userId: row["user_id"] === null ? null : Number(row["user_id"]),
    trialHash: (row["trial_hash"] as Buffer | null) ?? null,
    world: row["world"] as WorldId,
    difficulty: Number(row["difficulty"]) as DifficultyId,
    ranked: Boolean(row["ranked"]),
    seed: Number(row["seed"]),
    status: row["status"] as StoredGame["status"],
    startedAt: row["started_at"] as Date,
  });

  const findGame = async (id: number): Promise<StoredGame | null> => {
    const [row] = await rows(
      pool,
      "SELECT id, user_id, trial_hash, world, difficulty, ranked, seed, status, started_at " +
        "FROM games WHERE id = ?",
      [id],
    );
    return row ? toGame(row) : null;
  };

  return {
    async createTrial(idHash, expiresAt) {
      await run(pool, "INSERT INTO trial_sessions (id_hash, expires_at) VALUES (?, ?)", [
        idHash,
        expiresAt,
      ]);
    },

    async deleteTrial(idHash) {
      await run(pool, "DELETE FROM trial_sessions WHERE id_hash = ?", [idHash]);
    },

    async isLiveTrial(idHash, now) {
      const [row] = await rows(pool, "SELECT expires_at FROM trial_sessions WHERE id_hash = ?", [
        idHash,
      ]);
      return row !== undefined && (row["expires_at"] as Date) > now;
    },

    async startGame(owner, g) {
      if ("userId" in owner) {
        await run(pool, "DELETE FROM games WHERE user_id = ? AND status = 'started'", [
          owner.userId,
        ]);
      }
      try {
        const result = await run(
          pool,
          "INSERT INTO games (user_id, trial_hash, world, difficulty, ranked, seed, started_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            "userId" in owner ? owner.userId : null,
            "trialHash" in owner ? owner.trialHash : null,
            g.world,
            g.difficulty,
            g.ranked,
            g.seed,
            g.startedAt,
          ],
        );
        return result.insertId;
      } catch (error: unknown) {
        if ((error as { code?: unknown })?.code === "ER_DUP_ENTRY") return null;
        throw error;
      }
    },

    findGame,

    async dropGame(id) {
      await run(pool, "DELETE FROM games WHERE id = ? AND status = 'started'", [id]);
    },

    async endGame(id, o, log) {
      const game = await findGame(id);
      if (!game || game.status !== "started") return null;
      const ranked = game.ranked && game.userId !== null && o.kind !== "left";
      return transaction(ranked ? `limbes_top_${game.difficulty}` : null, async (db) => {
        const updated = await run(
          db,
          "UPDATE games SET status = ?, score = ?, level = ?, duration_ticks = ?, " +
            "bricks_broken = ?, lives_lost = ?, ended_at = ? WHERE id = ? AND status = 'started'",
          [o.kind, o.score, o.level, o.durationTicks, o.bricksBroken, o.livesLost, o.endedAt, id],
        );
        if (updated.affectedRows !== 1) return null;
        if (game.userId === null) return { rank: null };
        await addToPlayer(db, game.userId, { ...game, ...o });
        if (!ranked) return { rank: null };
        const rank = await enterTop(db, id, game.userId, game.difficulty, o.score);
        if (rank !== null) {
          await run(db, "INSERT INTO replay_logs (game_id, log) VALUES (?, ?)", [id, log]);
        }
        return { rank };
      });
    },

    async claimTrial(trialHash, userId) {
      await transaction(null, async (db) => {
        const [row] = await rows(
          db,
          "SELECT id, world, difficulty, status, score, level, duration_ticks, bricks_broken, " +
            "lives_lost FROM games WHERE trial_hash = ? FOR UPDATE",
          [trialHash],
        );
        if (row && row["status"] !== "started") {
          await run(db, "UPDATE games SET user_id = ?, trial_hash = NULL WHERE id = ?", [
            userId,
            Number(row["id"]),
          ]);
          await addToPlayer(db, userId, {
            kind: row["status"] as GameEndKind,
            world: row["world"] as WorldId,
            difficulty: Number(row["difficulty"]),
            score: Number(row["score"]),
            level: Number(row["level"]),
            durationTicks: Number(row["duration_ticks"]),
            bricksBroken: Number(row["bricks_broken"]),
            livesLost: Number(row["lives_lost"]),
          });
        }
        // A game never sent goes with the trial (ON DELETE CASCADE).
        await run(db, "DELETE FROM trial_sessions WHERE id_hash = ?", [trialHash]);
      });
    },

    async profile(userId) {
      const [stats] = await rows(
        pool,
        "SELECT games_played, play_ticks, max_level, bricks_broken, lives_lost " +
          "FROM player_stats WHERE user_id = ?",
        [userId],
      );
      const bests = await rows(
        pool,
        "SELECT world, difficulty, best_score FROM player_bests WHERE user_id = ?",
        [userId],
      );
      const records = await rows(
        pool,
        "SELECT difficulty, MAX(score) AS record FROM games WHERE user_id = ? " +
          `AND world = 'limbes' AND ranked = TRUE AND ${SCORED} GROUP BY difficulty`,
        [userId],
      );
      const latest = await rows(
        pool,
        "SELECT world, difficulty, ranked, score, level, duration_ticks, ended_at FROM games " +
          `WHERE user_id = ? AND ended_at IS NOT NULL ORDER BY ended_at DESC, id DESC LIMIT ${PROFILE_GAMES}`,
        [userId],
      );
      const places = await Promise.all(DIFFICULTIES.map((d) => bestEntry(pool, userId, d)));

      const best = Object.fromEntries(
        WORLD_IDS.map((w) => [
          w,
          triple((d) => {
            const found = bests.find((b) => b["world"] === w && Number(b["difficulty"]) === d);
            return found ? Number(found["best_score"]) : null;
          }),
        ]),
      ) as Profile["best"];
      return {
        counters: {
          gamesPlayed: stats ? Number(stats["games_played"]) : 0,
          playSeconds: stats ? seconds(Number(stats["play_ticks"])) : 0,
          maxLevel: stats ? Number(stats["max_level"]) : 0,
          livesLost: stats ? Number(stats["lives_lost"]) : 0,
          bricksBroken: stats ? Number(stats["bricks_broken"]) : 0,
        },
        best,
        ranked: triple((d) => {
          const record = records.find((r) => Number(r["difficulty"]) === d);
          const place = places[d];
          return {
            rank: place && place.rank <= SHOWN_RANKS ? place.rank : null,
            record: record ? Number(record["record"]) : null,
          };
        }),
        games: latest.map((r): GameRow => ({
          playedAt: (r["ended_at"] as Date).toISOString(),
          world: r["world"] as WorldId,
          difficulty: Number(r["difficulty"]) as DifficultyId,
          ranked: Boolean(r["ranked"]),
          score: Number(r["score"]),
          level: Number(r["level"]),
          durationSeconds: seconds(Number(r["duration_ticks"])),
        })),
      };
    },

    async leaderboard(difficulty, userId) {
      const top = await rows(
        pool,
        "SELECT t.user_id, t.score, u.pseudo, u.avatar FROM limbes_top t " +
          "JOIN users u ON u.id = t.user_id WHERE t.difficulty = ? " +
          `ORDER BY t.score DESC, t.game_id LIMIT ${SHOWN_RANKS}`,
        [difficulty],
      );
      const mine = userId === null ? null : await bestEntry(pool, userId, difficulty);
      const ids = [
        ...new Set([...top.map((r) => Number(r["user_id"])), ...(mine ? [userId!] : [])]),
      ];
      const counts = await rankedCounts(ids, difficulty);
      const entries = top.map((r, i): LeaderboardEntry => ({
        rank: i + 1,
        pseudo: String(r["pseudo"]),
        avatar: r["avatar"] === null ? null : Number(r["avatar"]),
        score: Number(r["score"]),
        gamesPlayed: counts.get(Number(r["user_id"])) ?? 0,
      }));
      let me: LeaderboardEntry | null = null;
      if (mine) {
        const [u] = await rows(pool, "SELECT pseudo, avatar FROM users WHERE id = ?", [userId!]);
        me = {
          rank: mine.rank,
          pseudo: String(u!["pseudo"]),
          avatar: u!["avatar"] === null ? null : Number(u!["avatar"]),
          score: mine.score,
          gamesPlayed: counts.get(userId!) ?? 0,
        };
      }
      return { entries, me };
    },

    async playerCard(pseudo, difficulty) {
      const [row] = await rows(
        pool,
        "SELECT u.id, u.pseudo, u.avatar, MAX(t.score) AS score FROM users u " +
          "JOIN limbes_top t ON t.user_id = u.id AND t.difficulty = ? WHERE u.pseudo = ? " +
          "GROUP BY u.id, u.pseudo, u.avatar",
        [difficulty, pseudo],
      );
      if (!row) return null;
      const id = Number(row["id"]);
      return {
        pseudo: String(row["pseudo"]),
        avatar: row["avatar"] === null ? null : Number(row["avatar"]),
        score: Number(row["score"]),
        gamesPlayed: (await rankedCounts([id], difficulty)).get(id) ?? 0,
      };
    },

    async cleanup(c) {
      // The trial's game goes with it (ON DELETE CASCADE).
      await run(pool, "DELETE FROM trial_sessions WHERE expires_at <= ?", [c.now]);
      await run(pool, "DELETE FROM games WHERE status = 'started' AND started_at <= ?", [
        c.startedBefore,
      ]);
    },
  };
}

interface GameForPlayer {
  kind: GameEndKind;
  world: WorldId;
  difficulty: number;
  score: number;
  level: number;
  durationTicks: number;
  bricksBroken: number;
  livesLost: number;
}
