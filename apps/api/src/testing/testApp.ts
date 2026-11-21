import { buildApp } from "../app";
import { createPasswordHasher } from "../auth/password";
import type { Db } from "../db";
import type { Mail, Mailer } from "../mail/mailer";
import type { ReplayJob, ReplayOutcome } from "../replay/job";
import { limitReplays } from "../replay/pool";
import { gameRateLimits, rateLimits } from "../routes/deps";
import { type MemoryAccounts, memoryAccounts } from "./memoryAccounts";
import { type MemoryGames, memoryGames } from "./memoryGames";

export const SITE_URL = "http://localhost:5174";

export interface TestApp {
  app: ReturnType<typeof buildApp>;
  store: MemoryAccounts;
  games: MemoryGames;
  mails: Mail[];
  clock: { now: Date; advance(ms: number): void };
  /** Stands for the engine: the asset pack is not in the repository. Throw to refuse a log. */
  replay: (job: ReplayJob) => Promise<ReplayOutcome>;
  /** Seeds handed out, in order. */
  seeds: number[];
}

/** A game over at level 3 for 12 000 points, 6 000 ticks long. */
export const DEFAULT_OUTCOME: ReplayOutcome = {
  kind: "game_over",
  score: 12_000,
  level: 3,
  durationTicks: 6_000,
  bricksBroken: 140,
  livesLost: 3,
};

/** The app on in-memory stores, a cheap scrypt, a mailbox array and a clock of its own. */
export function testApp(options: { dbUp?: boolean; mailer?: Mailer } = {}): TestApp {
  const db: Db = {
    ping: () =>
      options.dbUp === false
        ? Promise.reject(new Error("ECONNREFUSED 127.0.0.1:3306"))
        : Promise.resolve(),
    close: () => Promise.resolve(),
  };
  const store = memoryAccounts();
  const games = memoryGames(store);
  const mails: Mail[] = [];
  const clock = {
    now: new Date("2026-11-17T12:00:00Z"),
    advance(ms: number) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
  };
  const now = () => clock.now;
  let seed = 1000;
  const t: TestApp = {
    app: undefined as unknown as TestApp["app"],
    store,
    games,
    mails,
    clock,
    replay: async () => DEFAULT_OUTCOME,
    seeds: [],
  };
  t.app = buildApp({
    db,
    accounts: {
      store,
      hasher: createPasswordHasher({ logN: 10, r: 8, p: 1 }),
      mailer: options.mailer ?? { send: async (mail) => void mails.push(mail) },
      siteUrl: SITE_URL,
      now,
      limits: rateLimits(now),
      trials: games,
    },
    games: {
      store: games,
      accounts: store,
      replayer: limitReplays((job) => t.replay(job)),
      newSeed: () => {
        t.seeds.push(++seed);
        return seed;
      },
      now,
      limits: gameRateLimits(now),
    },
  });
  return t;
}
