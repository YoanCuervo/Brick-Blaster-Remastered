import { SESSION_IDLE_MS } from "./auth/sessions";
import type { AccountStore } from "./store/accounts";
import type { GameStore } from "./store/games";

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;
/** An account whose email was never confirmed is deleted after this (minimisation, RGPD). */
export const UNVERIFIED_KEEP_MS = 7 * 24 * HOUR_MS;
/** A sign-in lock untouched for this long is forgotten. */
export const THROTTLE_KEEP_MS = 24 * HOUR_MS;
/** A game never sent this long after its start is dropped: no replay may last beyond 10 hours. */
export const STARTED_KEEP_MS = 12 * HOUR_MS;
/**
 * An account unused for 3 years is deleted (RGPD art. 5.1.e). 1 096 days: never less than 3
 * calendar years, leap day included.
 */
export const INACTIVE_KEEP_MS = 1096 * DAY_MS;
/** The player is warned by email this long before, and the account is kept that long after. */
export const INACTIVITY_NOTICE_MS = 30 * DAY_MS;
/** Past 3 years and this, the account goes even if no warning could be sent. */
export const UNWARNED_GRACE_MS = 61 * DAY_MS;
/** Warnings per hourly run: 240 a day at most, under Brevo's free daily quota of 300. */
export const WARNINGS_PER_RUN = 10;

export function cleanupCutoffs(now: Date) {
  const ago = (ms: number) => new Date(now.getTime() - ms);
  return {
    now,
    idleSince: ago(SESSION_IDLE_MS),
    unverifiedBefore: ago(UNVERIFIED_KEEP_MS),
    throttleBefore: ago(THROTTLE_KEEP_MS),
    startedBefore: ago(STARTED_KEEP_MS),
    warnBefore: ago(INACTIVE_KEEP_MS - INACTIVITY_NOTICE_MS),
    inactiveBefore: ago(INACTIVE_KEEP_MS),
    warnedBefore: ago(INACTIVITY_NOTICE_MS),
    abandonedBefore: ago(INACTIVE_KEEP_MS + UNWARNED_GRACE_MS),
  };
}

export type Cutoffs = ReturnType<typeof cleanupCutoffs>;

/** Runs the purge at start, then every hour; the timer never keeps the process alive. */
export function startCleanup(
  store: AccountStore,
  games: GameStore,
  warnInactive: (cutoffs: Cutoffs) => Promise<void>,
  now: () => Date,
  onError: (error: unknown) => void,
): () => void {
  const run = () => {
    const cutoffs = cleanupCutoffs(now());
    void store.cleanup(cutoffs).catch(onError);
    void games.cleanup(cutoffs).catch(onError);
    void warnInactive(cutoffs).catch(onError);
  };
  run();
  const timer = setInterval(run, HOUR_MS);
  timer.unref();
  return () => clearInterval(timer);
}
