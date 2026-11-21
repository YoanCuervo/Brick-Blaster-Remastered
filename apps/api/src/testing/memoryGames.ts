import {
  type DifficultyId,
  KEPT_RANKS,
  type LeaderboardEntry,
  PROFILE_GAMES,
  type Profile,
  SHOWN_RANKS,
  TICKS_PER_SECOND,
  WORLD_IDS,
} from "@brick-blaster/contracts";
import type { GameOutcome, GameStore, StoredGame } from "../store/games";
import type { MemoryAccounts } from "./memoryAccounts";

/** The game store in memory, for the route tests: same answers as the MySQL one. */

interface GameRow extends StoredGame {
  outcome: GameOutcome | null;
}

export interface MemoryGames extends GameStore {
  games: Map<number, GameRow>;
  trials: Map<string, Date>;
  /** Gzipped logs of the kept ranked games. */
  logs: Map<number, Buffer>;
}

const key = (hash: Buffer) => hash.toString("hex");
const seconds = (ticks: number) => Math.round(ticks / TICKS_PER_SECOND);
const scored = (g: GameRow): g is GameRow & { outcome: GameOutcome } =>
  g.outcome !== null && g.outcome.kind !== "left";

export function memoryGames(accounts: MemoryAccounts): MemoryGames {
  const games = new Map<number, GameRow>();
  const trials = new Map<string, Date>();
  const logs = new Map<number, Buffer>();
  let nextId = 1;

  const ended = (userId: number) =>
    [...games.values()].filter((g) => g.userId === userId && g.outcome !== null);
  /** The kept ranks of a difficulty, best first; ties go to the earlier game. */
  const top = (difficulty: number) =>
    [...games.values()]
      .filter((g): g is GameRow & { outcome: GameOutcome } => g.ranked && g.userId !== null)
      .filter((g) => g.difficulty === difficulty && scored(g))
      .sort((a, b) => b.outcome.score - a.outcome.score || a.id - b.id)
      .slice(0, KEPT_RANKS);
  const rankedCount = (userId: number, difficulty: number) =>
    ended(userId).filter((g) => g.ranked && g.difficulty === difficulty).length;
  const entryOf = (g: GameRow & { outcome: GameOutcome }, rank: number): LeaderboardEntry => {
    const user = accounts.users.get(g.userId!)!;
    return {
      rank,
      pseudo: user.pseudo,
      avatar: user.avatar,
      score: g.outcome.score,
      gamesPlayed: rankedCount(user.id, g.difficulty),
    };
  };
  const bestPlace = (userId: number, difficulty: number) => {
    const index = top(difficulty).findIndex((g) => g.userId === userId);
    return index === -1 ? null : index + 1;
  };
  const dropTrial = (k: string) => {
    trials.delete(k);
    for (const [id, g] of games) if (g.trialHash && key(g.trialHash) === k) games.delete(id);
  };

  return {
    games,
    trials,
    logs,

    async createTrial(idHash, expiresAt) {
      trials.set(key(idHash), expiresAt);
    },

    async deleteTrial(idHash) {
      dropTrial(key(idHash));
    },

    async isLiveTrial(idHash, now) {
      const expiresAt = trials.get(key(idHash));
      return expiresAt !== undefined && expiresAt > now;
    },

    async startGame(owner, g) {
      if ("userId" in owner) {
        for (const [id, row] of games) {
          if (row.userId === owner.userId && row.status === "started") games.delete(id);
        }
      } else if ([...games.values()].some((row) => row.trialHash?.equals(owner.trialHash))) {
        return null;
      }
      const id = nextId++;
      games.set(id, {
        ...g,
        id,
        userId: "userId" in owner ? owner.userId : null,
        trialHash: "trialHash" in owner ? owner.trialHash : null,
        status: "started",
        outcome: null,
      });
      return id;
    },

    async findGame(id) {
      const row = games.get(id);
      if (!row) return null;
      const game: StoredGame & { outcome?: unknown } = { ...row };
      delete game.outcome;
      return game;
    },

    async dropGame(id) {
      if (games.get(id)?.status === "started") games.delete(id);
    },

    async endGame(id, outcome, log) {
      const row = games.get(id);
      if (!row || row.status !== "started") return null;
      row.status = outcome.kind;
      row.outcome = outcome;
      if (!row.ranked || row.userId === null || outcome.kind === "left") return { rank: null };
      const kept = top(row.difficulty);
      for (const logId of logs.keys()) {
        const g = games.get(logId);
        if (g?.difficulty === row.difficulty && !kept.includes(g as never)) logs.delete(logId);
      }
      const index = kept.indexOf(row as never);
      if (index === -1) return { rank: null };
      logs.set(id, log);
      return { rank: index + 1 };
    },

    async claimTrial(trialHash, userId) {
      const row = [...games.values()].find((g) => g.trialHash?.equals(trialHash));
      if (row && row.status !== "started") {
        row.userId = userId;
        row.trialHash = null;
      }
      dropTrial(key(trialHash));
    },

    async profile(userId) {
      const mine = ended(userId);
      const best = Object.fromEntries(
        WORLD_IDS.map((w) => [
          w,
          ([0, 1, 2] as const).map((d) => {
            const scores = mine
              .filter((g) => g.world === w && g.difficulty === d && scored(g))
              .map((g) => g.outcome!.score);
            return scores.length > 0 ? Math.max(...scores) : null;
          }),
        ]),
      ) as unknown as Profile["best"];
      const ranked = ([0, 1, 2] as const).map((d) => {
        const scores = mine
          .filter((g) => g.ranked && g.difficulty === d && scored(g))
          .map((g) => g.outcome!.score);
        const place = bestPlace(userId, d);
        return {
          rank: place !== null && place <= SHOWN_RANKS ? place : null,
          record: scores.length > 0 ? Math.max(...scores) : null,
        };
      }) as unknown as Profile["ranked"];
      const sum = (f: (o: GameOutcome) => number) =>
        mine.reduce((total, g) => total + f(g.outcome!), 0);
      return {
        counters: {
          gamesPlayed: mine.length,
          playSeconds: seconds(sum((o) => o.durationTicks)),
          maxLevel: Math.max(0, ...mine.map((g) => g.outcome!.level)),
          livesLost: sum((o) => o.livesLost),
          bricksBroken: sum((o) => o.bricksBroken),
        },
        best,
        ranked,
        games: mine
          .sort(
            (a, b) => b.outcome!.endedAt.getTime() - a.outcome!.endedAt.getTime() || b.id - a.id,
          )
          .slice(0, PROFILE_GAMES)
          .map((g) => ({
            playedAt: g.outcome!.endedAt.toISOString(),
            world: g.world,
            difficulty: g.difficulty,
            ranked: g.ranked,
            score: g.outcome!.score,
            level: g.outcome!.level,
            durationSeconds: seconds(g.outcome!.durationTicks),
          })),
      };
    },

    async leaderboard(difficulty, userId) {
      const kept = top(difficulty);
      const entries = kept.slice(0, SHOWN_RANKS).map((g, i) => entryOf(g, i + 1));
      const index = userId === null ? -1 : kept.findIndex((g) => g.userId === userId);
      return { entries, me: index === -1 ? null : entryOf(kept[index]!, index + 1) };
    },

    async playerCard(pseudo, difficulty: DifficultyId) {
      const entry = top(difficulty).find(
        (g) => accounts.users.get(g.userId!)!.pseudo.toLowerCase() === pseudo.toLowerCase(),
      );
      if (!entry) return null;
      const { pseudo: name, avatar, score, gamesPlayed } = entryOf(entry, 0);
      return { pseudo: name, avatar, score, gamesPlayed };
    },

    async cleanup(c) {
      for (const [k, expiresAt] of trials) if (expiresAt <= c.now) dropTrial(k);
      for (const [id, g] of games) {
        if (g.status === "started" && g.startedAt <= c.startedBefore) games.delete(id);
      }
    },
  };
}
