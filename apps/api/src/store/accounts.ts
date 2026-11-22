import type { AccountSettings, Me, SettingsBody } from "@brick-blaster/contracts";
import type mysql from "mysql2/promise";

/**
 * The precision of users.mouse_sensitivity, DECIMAL(3,2). A step of the game's bar is about
 * 0.047, so the bar comes back at the same position.
 */
export const roundSensitivity = (value: number): number => Math.round(value * 100) / 100;

/** What the account routes need from the database: a test stands in for it in memory. */
export interface AccountStore {
  /** Says which unique field stopped it when the email or the pseudo is already taken. */
  createUser(user: NewUser): Promise<{ id: number } | { taken: "email" | "pseudo" }>;
  findUserByEmail(email: string): Promise<UserLogin | null>;
  findPasswordHash(userId: number): Promise<string | null>;
  getMe(userId: number): Promise<Me | null>;
  markEmailVerified(userId: number, at: Date): Promise<void>;
  setPasswordHash(userId: number, hash: string): Promise<void>;
  /** False when another account holds the pseudo, whatever its case. */
  setPseudo(userId: number, pseudo: string): Promise<boolean>;
  setAvatar(userId: number, avatar: number): Promise<void>;
  /** Null when the account is gone. */
  getSettings(userId: number): Promise<AccountSettings | null>;
  setSettings(userId: number, settings: SettingsBody): Promise<void>;
  /** Its sessions and links go with it. */
  deleteUser(userId: number): Promise<void>;

  /** The player is back: the inactivity clock restarts and any warning is forgotten. */
  markActive(userId: number, at: Date): Promise<void>;
  /** Verified accounts inactive since `lastActiveBefore` and not yet warned, oldest first. */
  findAccountsToWarn(lastActiveBefore: Date, limit: number): Promise<InactiveAccount[]>;
  /** Not when the player came back in the meantime. */
  markInactivityWarned(userId: number, at: Date, lastActiveBefore: Date): Promise<void>;

  createSession(session: Session): Promise<void>;
  findSession(idHash: Buffer): Promise<Session | null>;
  touchSession(idHash: Buffer, at: Date): Promise<void>;
  deleteSession(idHash: Buffer): Promise<void>;
  deleteUserSessions(userId: number): Promise<void>;

  /** Replaces any earlier link of the same purpose: only the latest one works. */
  createToken(token: AccountToken): Promise<void>;
  /** Deletes the token and returns its user, if it was valid at `now`. */
  consumeToken(hash: Buffer, purpose: TokenPurpose, now: Date): Promise<number | null>;

  getThrottle(emailHash: Buffer): Promise<Throttle | null>;
  setThrottle(emailHash: Buffer, throttle: Throttle): Promise<void>;
  clearThrottle(emailHash: Buffer): Promise<void>;

  cleanup(cutoffs: CleanupCutoffs): Promise<void>;
}

export interface NewUser {
  email: string;
  passwordHash: string;
  pseudo: string;
  createdAt: Date;
}

export interface InactiveAccount {
  id: number;
  email: string;
}

export interface UserLogin {
  id: number;
  passwordHash: string;
  emailVerified: boolean;
}

export interface Session {
  idHash: Buffer;
  userId: number;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export type TokenPurpose = "verify_email" | "reset_password";

export interface AccountToken {
  hash: Buffer;
  userId: number;
  purpose: TokenPurpose;
  expiresAt: Date;
}

export interface Throttle {
  failures: number;
  lockLevel: number;
  lockedUntil: Date | null;
  updatedAt: Date;
}

export interface CleanupCutoffs {
  /** Sessions and links past their end before this. */
  now: Date;
  /** Sessions not seen since. */
  idleSince: Date;
  /** Accounts never verified, created before this. */
  unverifiedBefore: Date;
  /** Locks untouched since. */
  throttleBefore: Date;
  /** Accounts inactive since, if warned before `warnedBefore`. */
  inactiveBefore: Date;
  warnedBefore: Date;
  /** Accounts inactive since, warned or not: a warning that never went out delays no more. */
  abandonedBefore: Date;
}

type Row = mysql.RowDataPacket;
type Value = string | number | boolean | Date | Buffer | null;

const isDuplicate = (error: unknown): error is { code: string; message: string } =>
  (error as { code?: unknown })?.code === "ER_DUP_ENTRY";

export function createMysqlAccountStore(pool: mysql.Pool): AccountStore {
  const rows = async (sql: string, values: Value[]): Promise<Row[]> =>
    (await pool.execute<Row[]>(sql, values))[0];
  const run = async (sql: string, values: Value[]): Promise<mysql.ResultSetHeader> =>
    (await pool.execute<mysql.ResultSetHeader>(sql, values))[0];

  return {
    async createUser(user) {
      try {
        const result = await run(
          "INSERT INTO users (email, password_hash, pseudo, created_at, last_active_at) " +
            "VALUES (?, ?, ?, ?, ?)",
          [user.email, user.passwordHash, user.pseudo, user.createdAt, user.createdAt],
        );
        return { id: result.insertId };
      } catch (error: unknown) {
        if (!isDuplicate(error)) throw error;
        return { taken: error.message.includes("users_pseudo") ? "pseudo" : "email" };
      }
    },

    async findUserByEmail(email) {
      const [row] = await rows(
        "SELECT id, password_hash, email_verified_at FROM users WHERE email = ?",
        [email],
      );
      if (!row) return null;
      return {
        id: Number(row["id"]),
        passwordHash: String(row["password_hash"]),
        emailVerified: row["email_verified_at"] !== null,
      };
    },

    async findPasswordHash(userId) {
      const [row] = await rows("SELECT password_hash FROM users WHERE id = ?", [userId]);
      return row ? String(row["password_hash"]) : null;
    },

    async getMe(userId) {
      const [row] = await rows("SELECT pseudo, pseudo_chosen, avatar FROM users WHERE id = ?", [
        userId,
      ]);
      if (!row) return null;
      return {
        pseudo: String(row["pseudo"]),
        pseudoChosen: Boolean(row["pseudo_chosen"]),
        avatar: row["avatar"] === null ? null : Number(row["avatar"]),
      };
    },

    async markEmailVerified(userId, at) {
      await run(
        "UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL",
        [at, userId],
      );
    },

    async setPasswordHash(userId, hash) {
      await run("UPDATE users SET password_hash = ? WHERE id = ?", [hash, userId]);
    },

    async setPseudo(userId, pseudo) {
      try {
        await run("UPDATE users SET pseudo = ?, pseudo_chosen = TRUE WHERE id = ?", [
          pseudo,
          userId,
        ]);
        return true;
      } catch (error: unknown) {
        if (isDuplicate(error)) return false;
        throw error;
      }
    },

    async setAvatar(userId, avatar) {
      await run("UPDATE users SET avatar = ? WHERE id = ?", [avatar, userId]);
    },

    async getSettings(userId) {
      const [row] = await rows("SELECT music_volume, mouse_sensitivity FROM users WHERE id = ?", [
        userId,
      ]);
      if (!row) return null;
      // mysql2 gives a DECIMAL as a string.
      const number = (v: unknown) => (v === null ? null : Number(v));
      return {
        musicVolume: number(row["music_volume"]),
        mouseSensitivity: number(row["mouse_sensitivity"]),
      };
    },

    async setSettings(userId, settings) {
      await run("UPDATE users SET music_volume = ?, mouse_sensitivity = ? WHERE id = ?", [
        settings.musicVolume,
        roundSensitivity(settings.mouseSensitivity),
        userId,
      ]);
    },

    async deleteUser(userId) {
      await run("DELETE FROM users WHERE id = ?", [userId]);
    },

    async markActive(userId, at) {
      await run(
        "UPDATE users SET last_active_at = GREATEST(last_active_at, ?), " +
          "inactivity_warned_at = NULL WHERE id = ?",
        [at, userId],
      );
    },

    async findAccountsToWarn(lastActiveBefore, limit) {
      if (!Number.isInteger(limit) || limit < 1) throw new Error(`bad limit ${limit}`);
      // LIMIT takes no placeholder in a prepared statement: the integer is checked above.
      const found = await rows(
        "SELECT id, email FROM users WHERE email_verified_at IS NOT NULL " +
          "AND inactivity_warned_at IS NULL AND last_active_at <= ? " +
          `ORDER BY last_active_at LIMIT ${limit}`,
        [lastActiveBefore],
      );
      return found.map((row) => ({ id: Number(row["id"]), email: String(row["email"]) }));
    },

    async markInactivityWarned(userId, at, lastActiveBefore) {
      await run(
        "UPDATE users SET inactivity_warned_at = ? " +
          "WHERE id = ? AND inactivity_warned_at IS NULL AND last_active_at <= ?",
        [at, userId, lastActiveBefore],
      );
    },

    async createSession(s) {
      await run(
        "INSERT INTO sessions (id_hash, user_id, created_at, last_seen_at, expires_at) " +
          "VALUES (?, ?, ?, ?, ?)",
        [s.idHash, s.userId, s.createdAt, s.lastSeenAt, s.expiresAt],
      );
    },

    async findSession(idHash) {
      const [row] = await rows(
        "SELECT user_id, created_at, last_seen_at, expires_at FROM sessions WHERE id_hash = ?",
        [idHash],
      );
      if (!row) return null;
      return {
        idHash,
        userId: Number(row["user_id"]),
        createdAt: row["created_at"] as Date,
        lastSeenAt: row["last_seen_at"] as Date,
        expiresAt: row["expires_at"] as Date,
      };
    },

    async touchSession(idHash, at) {
      await run("UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?", [at, idHash]);
    },

    async deleteSession(idHash) {
      await run("DELETE FROM sessions WHERE id_hash = ?", [idHash]);
    },

    async deleteUserSessions(userId) {
      await run("DELETE FROM sessions WHERE user_id = ?", [userId]);
    },

    async createToken(t) {
      await run("DELETE FROM account_tokens WHERE user_id = ? AND purpose = ?", [
        t.userId,
        t.purpose,
      ]);
      await run(
        "INSERT INTO account_tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)",
        [t.hash, t.userId, t.purpose, t.expiresAt],
      );
    },

    async consumeToken(hash, purpose, now) {
      const [row] = await rows(
        "SELECT user_id, expires_at FROM account_tokens WHERE token_hash = ? AND purpose = ?",
        [hash, purpose],
      );
      if (!row) return null;
      // Only the request that deletes the row may use it: two clicks on a link spend it once.
      const deleted = await run("DELETE FROM account_tokens WHERE token_hash = ?", [hash]);
      if (deleted.affectedRows !== 1) return null;
      return (row["expires_at"] as Date) > now ? Number(row["user_id"]) : null;
    },

    async getThrottle(emailHash) {
      const [row] = await rows(
        "SELECT failures, lock_level, locked_until, updated_at FROM login_throttle " +
          "WHERE email_hash = ?",
        [emailHash],
      );
      if (!row) return null;
      return {
        failures: Number(row["failures"]),
        lockLevel: Number(row["lock_level"]),
        lockedUntil: (row["locked_until"] as Date | null) ?? null,
        updatedAt: row["updated_at"] as Date,
      };
    },

    async setThrottle(emailHash, t) {
      await run(
        "INSERT INTO login_throttle (email_hash, failures, lock_level, locked_until, updated_at) " +
          "VALUES (?, ?, ?, ?, ?) AS new ON DUPLICATE KEY UPDATE failures = new.failures, " +
          "lock_level = new.lock_level, locked_until = new.locked_until, updated_at = new.updated_at",
        [emailHash, t.failures, t.lockLevel, t.lockedUntil, t.updatedAt],
      );
    },

    async clearThrottle(emailHash) {
      await run("DELETE FROM login_throttle WHERE email_hash = ?", [emailHash]);
    },

    async cleanup(c) {
      await run("DELETE FROM sessions WHERE expires_at <= ? OR last_seen_at <= ?", [
        c.now,
        c.idleSince,
      ]);
      await run("DELETE FROM account_tokens WHERE expires_at <= ?", [c.now]);
      await run("DELETE FROM users WHERE email_verified_at IS NULL AND created_at <= ?", [
        c.unverifiedBefore,
      ]);
      await run(
        "DELETE FROM users WHERE last_active_at <= ? AND " +
          "(last_active_at <= ? OR inactivity_warned_at <= ?)",
        [c.inactiveBefore, c.abandonedBefore, c.warnedBefore],
      );
      await run("DELETE FROM login_throttle WHERE updated_at <= ?", [c.throttleBefore]);
    },
  };
}
