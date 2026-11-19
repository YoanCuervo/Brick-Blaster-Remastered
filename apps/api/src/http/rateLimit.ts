import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Requests per IP and per minute on the sensitive routes (docs/cadrage.md, Sécurité). Kept in
 * memory: the API is one process, and no IP address ever reaches the database.
 */

const WINDOW_MS = 60_000;

export interface RateLimiter {
  /** Seconds to wait, or 0 when the request may go on. */
  hit(key: string): number;
}

export function rateLimiter(perMinute: number, now: () => number): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  let nextSweep = 0;
  return {
    hit(key) {
      const t = now();
      if (t >= nextSweep) {
        for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
        nextSweep = t + WINDOW_MS;
      }
      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
        w = { count: 0, resetAt: t + WINDOW_MS };
        windows.set(key, w);
      }
      w.count++;
      return w.count > perMinute ? Math.ceil((w.resetAt - t) / 1000) : 0;
    },
  };
}

/** A preHandler that answers 429, with Retry-After, past the limit of the client's IP. */
export function limitByIp(limiter: RateLimiter) {
  return async (req: FastifyRequest, res: FastifyReply) => {
    const wait = limiter.hit(req.ip);
    if (wait > 0) {
      return res.code(429).header("retry-after", String(wait)).send({ error: "too_many_requests" });
    }
  };
}
