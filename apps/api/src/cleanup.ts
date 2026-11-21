import { SESSION_IDLE_MS } from "./auth/sessions";
import type { AccountStore } from "./store/accounts";
import type { GameStore } from "./store/games";

const HOUR_MS = 3600_000;
/** An account whose email was never confirmed is deleted after this (minimisation, RGPD). */
export const UNVERIFIED_KEEP_MS = 7 * 24 * HOUR_MS;
/** A sign-in lock untouched for this long is forgotten. */
export const THROTTLE_KEEP_MS = 24 * HOUR_MS;
/** A game never sent this long after its start is dropped: no replay may last beyond 10 hours. */
export const STARTED_KEEP_MS = 12 * HOUR_MS;

export function cleanupCutoffs(now: Date) {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  return {
    now,
    idleSince: ago(SESSION_IDLE_MS),
    unverifiedBefore: ago(UNVERIFIED_KEEP_MS),
    throttleBefore: ago(THROTTLE_KEEP_MS),
    startedBefore: ago(STARTED_KEEP_MS),
  };
}

/** Runs the purge at start, then every hour; the timer never keeps the process alive. */
export function startCleanup(
  store: AccountStore,
  games: GameStore,
  now: () => Date,
  onError: (error: unknown) => void,
): () => void {
  const run = () => {
    const cutoffs = cleanupCutoffs(now());
    void store.cleanup(cutoffs).catch(onError);
    void games.cleanup(cutoffs).catch(onError);
  };
  run();
  const timer = setInterval(run, HOUR_MS);
  timer.unref();
  return () => clearInterval(timer);
}
