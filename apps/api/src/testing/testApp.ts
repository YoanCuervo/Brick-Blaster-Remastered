import { buildApp } from "../app";
import { createPasswordHasher } from "../auth/password";
import type { Db } from "../db";
import type { Mail, Mailer } from "../mail/mailer";
import { rateLimits } from "../routes/deps";
import { type MemoryAccounts, memoryAccounts } from "./memoryAccounts";

export const SITE_URL = "http://localhost:5174";

export interface TestApp {
  app: ReturnType<typeof buildApp>;
  store: MemoryAccounts;
  mails: Mail[];
  clock: { now: Date; advance(ms: number): void };
}

/** The app on an in-memory store, a cheap scrypt, a mailbox array and a clock of its own. */
export function testApp(options: { dbUp?: boolean; mailer?: Mailer } = {}): TestApp {
  const db: Db = {
    ping: () =>
      options.dbUp === false
        ? Promise.reject(new Error("ECONNREFUSED 127.0.0.1:3306"))
        : Promise.resolve(),
    close: () => Promise.resolve(),
  };
  const store = memoryAccounts();
  const mails: Mail[] = [];
  const clock = {
    now: new Date("2026-11-17T12:00:00Z"),
    advance(ms: number) {
      clock.now = new Date(clock.now.getTime() + ms);
    },
  };
  const now = () => clock.now;
  const app = buildApp({
    db,
    accounts: {
      store,
      hasher: createPasswordHasher({ logN: 10, r: 8, p: 1 }),
      mailer: options.mailer ?? { send: async (mail) => void mails.push(mail) },
      siteUrl: SITE_URL,
      now,
      limits: rateLimits(now),
    },
  });
  return { app, store, mails, clock };
}
