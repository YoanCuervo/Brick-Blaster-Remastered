import type { FastifyReply, FastifyRequest } from "fastify";
import type { AccountStore } from "../store/accounts";
import { newToken, sha256 } from "./tokens";

/**
 * Server-side sessions (docs/cadrage.md, Sécurité): the cookie only carries a random id, the
 * database its SHA-256. No token the front could read.
 */

/** `__Host-`: the browser only takes it Secure, on Path=/, with no Domain. */
export const SESSION_COOKIE = "__Host-sid";
export const SESSION_IDLE_MS = 7 * 24 * 3600_000;
export const SESSION_MAX_MS = 30 * 24 * 3600_000;
/** Writing last_seen_at on every request would buy nothing at a 7-day scale. */
const TOUCH_EVERY_MS = 3600_000;

export interface CurrentSession {
  userId: number;
  idHash: Buffer;
}

function cookie(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

/** The session id of the request's Cookie header, if it has a well-formed one. */
export function sessionIdOf(req: FastifyRequest): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, value] = part.trim().split("=", 2);
    if (name === SESSION_COOKIE && value && /^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  }
  return null;
}

export async function startSession(
  store: AccountStore,
  res: FastifyReply,
  userId: number,
  now: Date,
): Promise<void> {
  const id = newToken();
  await store.createSession({
    idHash: sha256(id),
    userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_MAX_MS),
  });
  await store.markActive(userId, now);
  res.header("set-cookie", cookie(id, SESSION_MAX_MS / 1000));
}

export function clearSessionCookie(res: FastifyReply): void {
  res.header("set-cookie", cookie("", 0));
}

/** The live session of the request, or null; an expired or idle one is deleted on the way. */
export async function findSession(
  store: AccountStore,
  req: FastifyRequest,
  now: Date,
): Promise<CurrentSession | null> {
  const id = sessionIdOf(req);
  if (!id) return null;
  const idHash = sha256(id);
  const session = await store.findSession(idHash);
  if (!session) return null;
  const t = now.getTime();
  if (session.expiresAt.getTime() <= t || session.lastSeenAt.getTime() + SESSION_IDLE_MS <= t) {
    await store.deleteSession(idHash);
    return null;
  }
  // The account's activity, for the purge of inactive accounts, moves at the same pace.
  if (t - session.lastSeenAt.getTime() >= TOUCH_EVERY_MS) {
    await store.touchSession(idHash, now);
    await store.markActive(session.userId, now);
  }
  return { userId: session.userId, idHash };
}
