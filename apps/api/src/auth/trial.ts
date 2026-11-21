import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * The anonymous trial (docs/cadrage.md, Parcours): like the session, its cookie only carries a
 * random id, the database its SHA-256. It holds one game, and expires unless the player signs up.
 */
export const TRIAL_COOKIE = "__Host-trial";
export const TRIAL_TTL_MS = 24 * 3600_000;

function cookie(value: string, maxAgeSeconds: number): string {
  return `${TRIAL_COOKIE}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

/** The trial id of the request's Cookie header, if it has a well-formed one. */
export function trialIdOf(req: FastifyRequest): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, value] = part.trim().split("=", 2);
    if (name === TRIAL_COOKIE && value && /^[A-Za-z0-9_-]{43}$/.test(value)) return value;
  }
  return null;
}

/** Appended: a reply may set the session cookie too. */
export function setTrialCookie(res: FastifyReply, id: string): void {
  res.header("set-cookie", cookie(id, TRIAL_TTL_MS / 1000));
}

export function clearTrialCookie(res: FastifyReply): void {
  res.header("set-cookie", cookie("", 0));
}
