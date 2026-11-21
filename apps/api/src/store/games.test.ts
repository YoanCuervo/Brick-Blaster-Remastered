import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { KEPT_RANKS, SHOWN_RANKS } from "@brick-blaster/contracts";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigError, type Config, loadConfig } from "../config";
import { createPool } from "../db";
import { type AccountStore, createMysqlAccountStore } from "./accounts";
import { type GameOutcome, type GameStore, type NewGame, createMysqlGameStore } from "./games";

/**
 * Against the MySQL of apps/api/.env once `npm run migrate` has run, with accounts of its own
 * that it deletes afterwards, their games with them. Its scores sit near the top of the Limbes
 * leaderboards: on a database with real players, it would push the lowest kept ones out.
 * Skipped, and says so, without a database or without the tables.
 */
const ENV_FILE = new URL("../../.env", import.meta.url);
let config: Config | null = null;
try {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  config = loadConfig(process.env);
} catch (error: unknown) {
  if (!(error instanceof ConfigError)) throw error;
}

let pool: mysql.Pool | null = null;
let migrated = false;
if (config) {
  pool = createPool(config.db);
  try {
    await pool.query(
      "SELECT 1 FROM games, trial_sessions, limbes_top, replay_logs, player_stats, player_bests " +
        "LIMIT 0",
    );
    migrated = true;
  } catch {
    await pool.end();
    pool = null;
  }
}
if (!migrated) console.warn("game store tests skipped: no migrated database in apps/api/.env");

const tag = randomBytes(4).toString("hex");
const at = (iso: string) => new Date(iso);
// In the future: the purge of a running API (games started 12 hours ago, expired trials)
// must not reach the rows of this test.
const START = at("2099-11-17T12:00:00.000Z");
const outcome = (score: number, extra: Partial<GameOutcome> = {}): GameOutcome => ({
  kind: "game_over",
  score,
  level: 4,
  durationTicks: 6_000,
  bricksBroken: 120,
  livesLost: 3,
  endedAt: at("2099-11-17T12:05:00.000Z"),
  ...extra,
});
/** Above any score a player can make (999 990): the test's entries come first. */
const TOP = 2_000_000;

describe.skipIf(!migrated)("the game store on MySQL", () => {
  let store: GameStore;
  let accounts: AccountStore;
  beforeAll(() => {
    store = createMysqlGameStore(pool!);
    accounts = createMysqlAccountStore(pool!);
  });
  afterAll(async () => {
    await pool!.execute("DELETE FROM users WHERE email LIKE ?", [`%-${tag}@test.invalid`]);
    await pool!.end();
  });

  const newUser = async (name: string) => {
    const created = await accounts.createUser({
      email: `${name}-${tag}@test.invalid`,
      passwordHash: "scrypt$10$8$1$salt$hash",
      pseudo: `${name}${tag}`.slice(0, 15),
      createdAt: START,
    });
    if (!("id" in created)) throw new Error("not created");
    return created.id;
  };
  const play = async (
    userId: number,
    score: number,
    game: Pick<NewGame, "world" | "difficulty" | "ranked"> = {
      world: "limbes",
      difficulty: 2,
      ranked: true,
    },
    extra: Partial<GameOutcome> = {},
  ) => {
    const id = (await store.startGame(
      { userId },
      { ...game, seed: 4_000_000_000, startedAt: START },
    ))!;
    return { id, ...(await store.endGame(id, outcome(score, extra), Buffer.from("gz")))! };
  };

  it("starts a game with the server's seed, and ends it once", async () => {
    const userId = await newUser("a");
    const id = (await store.startGame(
      { userId },
      { world: "arcade", difficulty: 0, ranked: false, seed: 0xffffffff, startedAt: START },
    ))!;
    expect(await store.findGame(id)).toEqual({
      id,
      userId,
      trialHash: null,
      world: "arcade",
      difficulty: 0,
      ranked: false,
      seed: 0xffffffff,
      status: "started",
      startedAt: START,
    });
    expect(await store.endGame(id, outcome(500, { kind: "left" }), Buffer.from(""))).toEqual({
      rank: null,
    });
    expect(await store.endGame(id, outcome(900), Buffer.from(""))).toBeNull();
    expect((await store.findGame(id))!.status).toBe("left");
  });

  it("keeps one game waiting per player, and drops a refused one", async () => {
    const userId = await newUser("b");
    const game = {
      world: "espace",
      difficulty: 1,
      ranked: false,
      seed: 1,
      startedAt: START,
    } as const;
    const first = (await store.startGame({ userId }, game))!;
    const second = (await store.startGame({ userId }, game))!;
    expect(await store.findGame(first)).toBeNull();
    await store.dropGame(second);
    expect(await store.findGame(second)).toBeNull();
  });

  it("counts every game for the player, scores only the ones not left", async () => {
    const userId = await newUser("c");
    const solo = { world: "espace", difficulty: 1, ranked: false } as const;
    await play(userId, 7_000, solo);
    await play(userId, 9_000, solo, { kind: "left", level: 9 });
    await play(userId, 3_000, solo, { kind: "finished", endedAt: at("2099-11-17T12:09:00.000Z") });
    const profile = await store.profile(userId);
    expect(profile.counters).toEqual({
      gamesPlayed: 3,
      playSeconds: 300,
      maxLevel: 9,
      livesLost: 9,
      bricksBroken: 360,
    });
    expect(profile.best).toEqual({
      espace: [null, 7_000, null],
      arcade: [null, null, null],
      limbes: [null, null, null],
    });
    expect(profile.games.map((g) => g.score)).toEqual([3_000, 9_000, 7_000]);
    expect(profile.games[0]).toEqual({
      playedAt: "2099-11-17T12:09:00.000Z",
      world: "espace",
      difficulty: 1,
      ranked: false,
      score: 3_000,
      level: 4,
      durationSeconds: 100,
    });
  });

  it("ranks the Limbes, ties to the earlier game, with the player's line and card", async () => {
    const nova = await newUser("d");
    const kasso = await newUser("e");
    expect((await play(nova, TOP + 5)).rank).toBe(1);
    expect((await play(kasso, TOP + 9)).rank).toBe(1);
    expect((await play(kasso, TOP + 5)).rank).toBe(3);
    await play(nova, TOP + 1, { world: "limbes", difficulty: 2, ranked: true }, { kind: "left" });

    const board = await store.leaderboard(2, nova);
    expect(board.entries.slice(0, 3)).toEqual([
      { rank: 1, pseudo: `e${tag}`, avatar: null, score: TOP + 9, gamesPlayed: 2 },
      { rank: 2, pseudo: `d${tag}`, avatar: null, score: TOP + 5, gamesPlayed: 2 },
      { rank: 3, pseudo: `e${tag}`, avatar: null, score: TOP + 5, gamesPlayed: 2 },
    ]);
    expect(board.me).toEqual(board.entries[1]);
    expect((await store.leaderboard(2, null)).me).toBeNull();
    expect((await store.profile(nova)).ranked[2]).toEqual({ rank: 2, record: TOP + 5 });
    expect(await store.playerCard(`D${tag}`, 2)).toEqual({
      pseudo: `d${tag}`,
      avatar: null,
      score: TOP + 5,
      gamesPlayed: 2,
    });
    expect(await store.playerCard(`d${tag}`, 1)).toBeNull();
  });

  it("keeps the best 1000 of a difficulty, and the logs of those only", async () => {
    const userId = await newUser("f");
    const logs = async () =>
      Number(
        (
          await pool!.query<mysql.RowDataPacket[]>(
            "SELECT COUNT(*) AS n FROM replay_logs r JOIN limbes_top t USING (game_id) " +
              "WHERE t.difficulty = 0",
          )
        )[0][0]!["n"],
      );
    const game = { world: "limbes", difficulty: 0, ranked: true } as const;
    // Straight SQL: 1000 games through endGame would take a while.
    const [first] = await pool!.query<mysql.ResultSetHeader>(
      "INSERT INTO games (user_id, world, difficulty, ranked, seed, status, score, level, " +
        "duration_ticks, bricks_broken, lives_lost, started_at, ended_at) VALUES ?",
      [
        Array.from({ length: KEPT_RANKS }, (_, i) => [
          userId,
          "limbes",
          0,
          true,
          i,
          "game_over",
          TOP + 10 + i,
          1,
          60,
          0,
          1,
          START,
          START,
        ]),
      ],
    );
    const ids = Array.from({ length: KEPT_RANKS }, (_, i) => first.insertId + i);
    await pool!.query("INSERT INTO limbes_top (game_id, user_id, difficulty, score) VALUES ?", [
      ids.map((id, i) => [id, userId, 0, TOP + 10 + i]),
    ]);
    await pool!.query("INSERT INTO replay_logs (game_id, log) VALUES ?", [
      ids.map((id) => [id, Buffer.from("gz")]),
    ]);
    const before = await logs();

    const low = await play(userId, TOP, game);
    expect(low.rank).toBeNull();
    expect(await logs()).toBe(before);

    const high = await play(userId, TOP + 5_000, game);
    expect(high.rank).toBe(1);
    expect(await logs()).toBe(before);
    const [gone] = await pool!.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM limbes_top WHERE game_id = ?",
      [ids[0]!],
    );
    expect(Number(gone[0]!["n"])).toBe(0);
    expect((await store.leaderboard(0, userId)).entries).toHaveLength(SHOWN_RANKS);
  });

  it("gives an ended trial game to the account, and purges the rest", async () => {
    const trialHash = randomBytes(32);
    await store.createTrial(trialHash, at("2099-11-18T12:00:00.000Z"));
    expect(await store.isLiveTrial(trialHash, START)).toBe(true);
    expect(await store.isLiveTrial(trialHash, at("2099-11-18T12:00:00.000Z"))).toBe(false);
    const trial = {
      world: "espace",
      difficulty: 1,
      ranked: false,
      seed: 5,
      startedAt: START,
    } as const;
    const id = (await store.startGame({ trialHash }, trial))!;
    expect(await store.startGame({ trialHash }, trial)).toBeNull();
    await store.endGame(id, outcome(4_200), Buffer.from(""));

    const userId = await newUser("g");
    await store.claimTrial(trialHash, userId);
    expect(await store.isLiveTrial(trialHash, START)).toBe(false);
    expect((await store.findGame(id))!.userId).toBe(userId);
    expect((await store.profile(userId)).best.espace).toEqual([null, 4_200, null]);

    const lost = randomBytes(32);
    await store.createTrial(lost, at("2000-01-02T00:00:00.000Z"));
    const lostGame = (await store.startGame({ trialHash: lost }, trial))!;
    const waiting = (await store.startGame(
      { userId },
      { ...trial, startedAt: at("2000-01-01T00:00:00.000Z") },
    ))!;
    await store.cleanup({
      now: at("2000-01-02T00:00:00.000Z"),
      startedBefore: at("2000-01-01T12:00:00.000Z"),
    });
    expect(await store.findGame(lostGame)).toBeNull();
    expect(await store.findGame(waiting)).toBeNull();
    expect(await store.findGame(id)).not.toBeNull();
  });
});
