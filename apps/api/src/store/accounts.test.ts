import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigError, type Config, loadConfig } from "../config";
import { createPool } from "../db";
import { type AccountStore, createMysqlAccountStore } from "./accounts";

/**
 * Against the MySQL of apps/api/.env once `npm run migrate` has run, with accounts of its own
 * that it deletes afterwards. Skipped, and says so, without a database or without the tables.
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
    await pool.query("SELECT 1 FROM users, sessions, account_tokens, login_throttle LIMIT 0");
    migrated = true;
  } catch {
    await pool.end();
    pool = null;
  }
}
if (!migrated) console.warn("account store tests skipped: no migrated database in apps/api/.env");

const tag = randomBytes(4).toString("hex");
const email = (name: string) => `${name}-${tag}@test.invalid`;
const pseudo = (name: string) => `${name}${tag}`.slice(0, 15);
const at = (iso: string) => new Date(iso);
/** Cutoffs before any account of the tests: the purge of inactive accounts touches none. */
const NOTHING_INACTIVE = {
  inactiveBefore: at("1999-01-01T00:00:00Z"),
  warnedBefore: at("1999-01-01T00:00:00Z"),
  abandonedBefore: at("1999-01-01T00:00:00Z"),
};

describe.skipIf(!migrated)("the account store on MySQL", () => {
  let store: AccountStore;
  beforeAll(() => {
    store = createMysqlAccountStore(pool!);
  });
  afterAll(async () => {
    await pool!.execute("DELETE FROM users WHERE email LIKE ?", [`%-${tag}@test.invalid`]);
    await pool!.end();
  });

  const newUser = async (name: string) => {
    const created = await store.createUser({
      email: email(name),
      passwordHash: "scrypt$10$8$1$salt$hash",
      pseudo: pseudo(name),
      // Far in the past, so that the purge below can only reach the rows of this test.
      createdAt: at("2000-01-01T12:00:00.123Z"),
    });
    if (!("id" in created)) throw new Error("not created");
    return created.id;
  };

  it("creates a user, unverified, and tells which unique field stops a second one", async () => {
    const id = await newUser("a");
    expect(await store.findUserByEmail(email("a"))).toEqual({
      id,
      passwordHash: "scrypt$10$8$1$salt$hash",
      emailVerified: false,
    });
    expect(await store.getMe(id)).toEqual({
      pseudo: pseudo("a"),
      pseudoChosen: false,
      avatar: null,
    });
    const again = (e: string, p: string) =>
      store.createUser({ email: e, passwordHash: "h", pseudo: p, createdAt: new Date() });
    expect(await again(email("a"), pseudo("z"))).toEqual({ taken: "email" });
    expect(await again(email("z"), pseudo("a").toUpperCase())).toEqual({ taken: "pseudo" });
  });

  it("changes the pseudo, unique whatever its case, and the avatar", async () => {
    const a = await newUser("b");
    const b = await newUser("c");
    expect(await store.setPseudo(a, `Nova${tag}`)).toBe(true);
    expect(await store.setPseudo(b, `NOVA${tag}`)).toBe(false);
    expect(await store.setPseudo(a, `nova${tag}`)).toBe(true);
    await store.setAvatar(a, 7);
    expect(await store.getMe(a)).toEqual({ pseudo: `nova${tag}`, pseudoChosen: true, avatar: 7 });
  });

  it("keeps the game settings, null until set, the sensitivity to the hundredth", async () => {
    const id = await newUser("s");
    expect(await store.getSettings(id)).toEqual({ musicVolume: null, mouseSensitivity: null });
    await store.setSettings(id, { musicVolume: 64, mouseSensitivity: 0.1 + (18 / 62) * 2.9 });
    expect(await store.getSettings(id)).toEqual({ musicVolume: 64, mouseSensitivity: 0.94 });
    await store.setSettings(id, { musicVolume: 0, mouseSensitivity: 3 });
    expect(await store.getSettings(id)).toEqual({ musicVolume: 0, mouseSensitivity: 3 });
    expect(await store.getSettings(id + 1_000_000)).toBeNull();
  });

  it("keeps sessions by hash, and drops them with their user", async () => {
    const id = await newUser("d");
    const idHash = randomBytes(32);
    const session = {
      idHash,
      userId: id,
      createdAt: at("2026-11-17T12:00:00.000Z"),
      lastSeenAt: at("2026-11-17T12:00:00.000Z"),
      expiresAt: at("2026-12-17T12:00:00.000Z"),
    };
    await store.createSession(session);
    expect(await store.findSession(idHash)).toEqual(session);
    await store.touchSession(idHash, at("2026-11-18T09:30:00.500Z"));
    expect((await store.findSession(idHash))!.lastSeenAt).toEqual(at("2026-11-18T09:30:00.500Z"));
    await store.deleteUser(id);
    expect(await store.findSession(idHash)).toBeNull();
  });

  it("spends a token once, and only for its purpose and before its end", async () => {
    const id = await newUser("e");
    const hash = randomBytes(32);
    const expiresAt = at("2026-11-17T13:00:00.000Z");
    await store.createToken({ hash, userId: id, purpose: "reset_password", expiresAt });
    expect(await store.consumeToken(hash, "verify_email", at("2026-11-17T12:00:00Z"))).toBeNull();
    expect(await store.consumeToken(hash, "reset_password", at("2026-11-17T12:00:00Z"))).toBe(id);
    expect(await store.consumeToken(hash, "reset_password", at("2026-11-17T12:00:00Z"))).toBeNull();

    const late = randomBytes(32);
    await store.createToken({ hash: late, userId: id, purpose: "reset_password", expiresAt });
    expect(await store.consumeToken(late, "reset_password", expiresAt)).toBeNull();
  });

  it("replaces an earlier link of the same purpose", async () => {
    const id = await newUser("f");
    const first = randomBytes(32);
    const second = randomBytes(32);
    const expiresAt = at("2030-01-01T00:00:00Z");
    await store.createToken({ hash: first, userId: id, purpose: "verify_email", expiresAt });
    await store.createToken({ hash: second, userId: id, purpose: "verify_email", expiresAt });
    expect(await store.consumeToken(first, "verify_email", new Date())).toBeNull();
    expect(await store.consumeToken(second, "verify_email", new Date())).toBe(id);
  });

  it("writes, overwrites and clears a sign-in lock", async () => {
    const emailHash = randomBytes(32);
    const first = {
      failures: 3,
      lockLevel: 0,
      lockedUntil: null,
      updatedAt: at("2026-11-17T12:00:00Z"),
    };
    await store.setThrottle(emailHash, first);
    expect(await store.getThrottle(emailHash)).toEqual(first);
    const locked = { ...first, failures: 0, lockLevel: 1, lockedUntil: at("2026-11-17T12:01:00Z") };
    await store.setThrottle(emailHash, locked);
    expect(await store.getThrottle(emailHash)).toEqual(locked);
    await store.clearThrottle(emailHash);
    expect(await store.getThrottle(emailHash)).toBeNull();
  });

  it("marks an email verified, then purges only the old unverified accounts", async () => {
    const verified = await newUser("g");
    const unverified = await newUser("h");
    await store.markEmailVerified(verified, at("2026-11-17T12:05:00Z"));
    expect((await store.findUserByEmail(email("g")))!.emailVerified).toBe(true);
    await store.cleanup({
      now: at("2000-01-02T00:00:00Z"),
      idleSince: at("2000-01-02T00:00:00Z"),
      unverifiedBefore: at("2000-01-02T00:00:00Z"),
      throttleBefore: at("2000-01-02T00:00:00Z"),
      ...NOTHING_INACTIVE,
    });
    expect(await store.getMe(verified)).not.toBeNull();
    expect(await store.getMe(unverified)).toBeNull();
  });

  it("warns an inactive verified account once, forgets it when the player is back", async () => {
    const activity = async (id: number) => {
      const [rows] = await pool!.execute<mysql.RowDataPacket[]>(
        "SELECT last_active_at, inactivity_warned_at FROM users WHERE id = ?",
        [id],
      );
      return { active: rows[0]!["last_active_at"], warned: rows[0]!["inactivity_warned_at"] };
    };
    const idle = await newUser("i");
    const fresh = await newUser("j");
    const unverified = await newUser("k");
    await store.markEmailVerified(idle, at("2000-01-01T12:05:00Z"));
    await store.markEmailVerified(fresh, at("2000-01-01T12:05:00Z"));
    await store.markActive(fresh, at("2000-06-01T00:00:00Z"));
    // Never backwards.
    await store.markActive(fresh, at("2000-02-01T00:00:00Z"));
    expect(await activity(idle)).toEqual({ active: at("2000-01-01T12:00:00.123Z"), warned: null });
    expect((await activity(fresh)).active).toEqual(at("2000-06-01T00:00:00Z"));

    const before = at("2000-03-01T00:00:00Z");
    const mine = async () =>
      (await store.findAccountsToWarn(before, 1000)).filter((a) =>
        [idle, fresh, unverified].includes(a.id),
      );
    // The unverified "k" and the recently active "j" are not due.
    expect(await mine()).toEqual([{ id: idle, email: email("i") }]);
    await store.markInactivityWarned(idle, at("2000-03-02T00:00:00Z"), before);
    expect((await activity(idle)).warned).toEqual(at("2000-03-02T00:00:00Z"));
    expect(await mine()).toEqual([]);

    await store.markActive(idle, at("2000-03-03T00:00:00Z"));
    expect(await activity(idle)).toEqual({ active: at("2000-03-03T00:00:00Z"), warned: null });
    // Back during the sending: the warning is not marked.
    await store.markInactivityWarned(idle, at("2000-03-04T00:00:00Z"), before);
    expect((await activity(idle)).warned).toBeNull();
  });

  it("purges an inactive account 30 days after its warning, or past the grace without", async () => {
    const warned = await newUser("l");
    const unwarned = await newUser("m");
    const recent = await newUser("n");
    for (const id of [warned, unwarned, recent]) {
      await store.markEmailVerified(id, at("2000-01-01T12:05:00Z"));
    }
    await store.markInactivityWarned(
      warned,
      at("2000-02-01T00:00:00Z"),
      at("2000-01-02T00:00:00Z"),
    );
    await store.markActive(recent, at("2000-05-01T00:00:00Z"));
    const purge = (warnedBefore: string, abandonedBefore: string) =>
      store.cleanup({
        now: at("1999-01-01T00:00:00Z"),
        idleSince: at("1999-01-01T00:00:00Z"),
        unverifiedBefore: at("1999-01-01T00:00:00Z"),
        throttleBefore: at("1999-01-01T00:00:00Z"),
        inactiveBefore: at("2000-04-01T00:00:00Z"),
        warnedBefore: at(warnedBefore),
        abandonedBefore: at(abandonedBefore),
      });
    await purge("2000-01-31T00:00:00Z", "1999-12-01T00:00:00Z");
    expect(await store.getMe(warned)).not.toBeNull();
    await purge("2000-02-01T00:00:00Z", "1999-12-01T00:00:00Z");
    expect(await store.getMe(warned)).toBeNull();
    expect(await store.getMe(unwarned)).not.toBeNull();
    await purge("2000-02-01T00:00:00Z", "2000-01-01T12:00:00.123Z");
    expect(await store.getMe(unwarned)).toBeNull();
    expect(await store.getMe(recent)).not.toBeNull();
  });
});
