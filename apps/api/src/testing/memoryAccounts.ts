import type { AccountSettings, Me } from "@brick-blaster/contracts";
import {
  type AccountStore,
  type AccountToken,
  type Session,
  type Throttle,
  roundSensitivity,
} from "../store/accounts";

/** The account store in memory, for the route tests: same answers as the MySQL one. */

interface UserRow {
  id: number;
  email: string;
  passwordHash: string;
  pseudo: string;
  pseudoChosen: boolean;
  avatar: number | null;
  settings: AccountSettings;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  lastActiveAt: Date;
  inactivityWarnedAt: Date | null;
}

export interface MemoryAccounts extends AccountStore {
  users: Map<number, UserRow>;
  sessions: Map<string, Session>;
  tokens: Map<string, AccountToken>;
  throttles: Map<string, Throttle>;
}

const key = (hash: Buffer) => hash.toString("hex");

export function memoryAccounts(): MemoryAccounts {
  const users = new Map<number, UserRow>();
  const sessions = new Map<string, Session>();
  const tokens = new Map<string, AccountToken>();
  const throttles = new Map<string, Throttle>();
  let nextId = 1;
  const pseudoTaken = (pseudo: string, except?: number) =>
    [...users.values()].some(
      (u) => u.id !== except && u.pseudo.toLowerCase() === pseudo.toLowerCase(),
    );
  const dropWhere = <T>(map: Map<string, T>, test: (value: T) => boolean) => {
    for (const [k, v] of map) if (test(v)) map.delete(k);
  };

  return {
    users,
    sessions,
    tokens,
    throttles,

    async createUser(user) {
      if ([...users.values()].some((u) => u.email === user.email)) return { taken: "email" };
      if (pseudoTaken(user.pseudo)) return { taken: "pseudo" };
      const id = nextId++;
      users.set(id, {
        id,
        email: user.email,
        passwordHash: user.passwordHash,
        pseudo: user.pseudo,
        pseudoChosen: false,
        avatar: null,
        settings: { musicVolume: null, mouseSensitivity: null },
        emailVerifiedAt: null,
        createdAt: user.createdAt,
        lastActiveAt: user.createdAt,
        inactivityWarnedAt: null,
      });
      return { id };
    },
    async findUserByEmail(email) {
      const u = [...users.values()].find((row) => row.email === email);
      return u
        ? { id: u.id, passwordHash: u.passwordHash, emailVerified: !!u.emailVerifiedAt }
        : null;
    },
    async findPasswordHash(userId) {
      return users.get(userId)?.passwordHash ?? null;
    },
    async getMe(userId): Promise<Me | null> {
      const u = users.get(userId);
      return u ? { pseudo: u.pseudo, pseudoChosen: u.pseudoChosen, avatar: u.avatar } : null;
    },
    async markEmailVerified(userId, at) {
      const u = users.get(userId);
      if (u && !u.emailVerifiedAt) u.emailVerifiedAt = at;
    },
    async setPasswordHash(userId, hash) {
      const u = users.get(userId);
      if (u) u.passwordHash = hash;
    },
    async setPseudo(userId, pseudo) {
      if (pseudoTaken(pseudo, userId)) return false;
      const u = users.get(userId);
      if (u) Object.assign(u, { pseudo, pseudoChosen: true });
      return true;
    },
    async setAvatar(userId, avatar) {
      const u = users.get(userId);
      if (u) u.avatar = avatar;
    },
    async getSettings(userId) {
      const u = users.get(userId);
      return u ? { ...u.settings } : null;
    },
    async setSettings(userId, settings) {
      const u = users.get(userId);
      if (u) {
        u.settings = {
          musicVolume: settings.musicVolume,
          mouseSensitivity: roundSensitivity(settings.mouseSensitivity),
        };
      }
    },
    async deleteUser(userId) {
      users.delete(userId);
      dropWhere(sessions, (s) => s.userId === userId);
      dropWhere(tokens, (t) => t.userId === userId);
    },
    async markActive(userId, at) {
      const u = users.get(userId);
      if (u)
        Object.assign(u, {
          lastActiveAt: at > u.lastActiveAt ? at : u.lastActiveAt,
          inactivityWarnedAt: null,
        });
    },
    async findAccountsToWarn(lastActiveBefore, limit) {
      return [...users.values()]
        .filter(
          (u) => u.emailVerifiedAt && !u.inactivityWarnedAt && u.lastActiveAt <= lastActiveBefore,
        )
        .sort((a, b) => a.lastActiveAt.getTime() - b.lastActiveAt.getTime())
        .slice(0, limit)
        .map((u) => ({ id: u.id, email: u.email }));
    },
    async markInactivityWarned(userId, at, lastActiveBefore) {
      const u = users.get(userId);
      if (u && !u.inactivityWarnedAt && u.lastActiveAt <= lastActiveBefore)
        u.inactivityWarnedAt = at;
    },

    async createSession(session) {
      sessions.set(key(session.idHash), { ...session });
    },
    async findSession(idHash) {
      const s = sessions.get(key(idHash));
      return s ? { ...s } : null;
    },
    async touchSession(idHash, at) {
      const s = sessions.get(key(idHash));
      if (s) s.lastSeenAt = at;
    },
    async deleteSession(idHash) {
      sessions.delete(key(idHash));
    },
    async deleteUserSessions(userId) {
      dropWhere(sessions, (s) => s.userId === userId);
    },

    async createToken(token) {
      dropWhere(tokens, (t) => t.userId === token.userId && t.purpose === token.purpose);
      tokens.set(key(token.hash), { ...token });
    },
    async consumeToken(hash, purpose, now) {
      const t = tokens.get(key(hash));
      if (!t || t.purpose !== purpose) return null;
      tokens.delete(key(hash));
      return t.expiresAt > now ? t.userId : null;
    },

    async getThrottle(emailHash) {
      const t = throttles.get(key(emailHash));
      return t ? { ...t } : null;
    },
    async setThrottle(emailHash, throttle) {
      throttles.set(key(emailHash), { ...throttle });
    },
    async clearThrottle(emailHash) {
      throttles.delete(key(emailHash));
    },

    async cleanup(c) {
      dropWhere(sessions, (s) => s.expiresAt <= c.now || s.lastSeenAt <= c.idleSince);
      dropWhere(tokens, (t) => t.expiresAt <= c.now);
      for (const [id, u] of users) {
        const unverified = !u.emailVerifiedAt && u.createdAt <= c.unverifiedBefore;
        const inactive =
          u.lastActiveAt <= c.inactiveBefore &&
          (u.lastActiveAt <= c.abandonedBefore ||
            (u.inactivityWarnedAt !== null && u.inactivityWarnedAt <= c.warnedBefore));
        if (unverified || inactive) await this.deleteUser(id);
      }
      dropWhere(throttles, (t) => t.updatedAt <= c.throttleBefore);
    },
  };
}
