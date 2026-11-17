import type { Throttle } from "../store/accounts";

/**
 * Progressive sign-in lock (docs/cadrage.md, Sécurité): after 5 failures, 1 minute, then 5,
 * then 15 at most, never a final block that would let anyone shut another player out.
 */

export const FAILURES_BEFORE_LOCK = 5;
export const LOCK_MINUTES = [1, 5, 15] as const;

/** Seconds left on the lock at `now`, 0 when sign-in may be tried. */
export function lockSeconds(throttle: Throttle | null, now: Date): number {
  const until = throttle?.lockedUntil;
  return until && until > now ? Math.ceil((until.getTime() - now.getTime()) / 1000) : 0;
}

/** The state after one more failure; a fifth one sets the next, longer lock. */
export function afterFailure(throttle: Throttle | null, now: Date): Throttle {
  const failures = (throttle?.failures ?? 0) + 1;
  const level = throttle?.lockLevel ?? 0;
  if (failures < FAILURES_BEFORE_LOCK) {
    return {
      failures,
      lockLevel: level,
      lockedUntil: throttle?.lockedUntil ?? null,
      updatedAt: now,
    };
  }
  const minutes = LOCK_MINUTES[Math.min(level, LOCK_MINUTES.length - 1)]!;
  return {
    failures: 0,
    lockLevel: Math.min(level + 1, LOCK_MINUTES.length),
    lockedUntil: new Date(now.getTime() + minutes * 60_000),
    updatedAt: now,
  };
}
