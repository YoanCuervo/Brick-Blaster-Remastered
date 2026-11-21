import type { PasswordHasher } from "../auth/password";
import { type RateLimiter, rateLimiter } from "../http/rateLimit";
import type { Mailer } from "../mail/mailer";
import type { Replayer } from "../replay/pool";
import type { AccountStore } from "../store/accounts";
import type { GameStore } from "../store/games";

/** What the account routes are built from: the server passes the real ones, tests fakes. */
export interface AccountDeps {
  store: AccountStore;
  hasher: PasswordHasher;
  mailer: Mailer;
  /** Origin of the website, for the links of the emails. */
  siteUrl: string;
  now: () => Date;
  limits: RateLimits;
  /** At sign-up, the trial game of the browser passes to the new account. */
  trials: Pick<GameStore, "claimTrial">;
}

/** What the game and score routes are built from. */
export interface GameDeps {
  store: GameStore;
  /** For the session of the request. */
  accounts: AccountStore;
  replayer: Replayer;
  newSeed: () => number;
  now: () => Date;
  limits: GameRateLimits;
}

export interface GameRateLimits {
  start: RateLimiter;
  trial: RateLimiter;
  /** Sending a log: each one costs a replay. */
  log: RateLimiter;
}

export interface RateLimits {
  signUp: RateLimiter;
  signIn: RateLimiter;
  /** Asking for a verification or reset link. */
  email: RateLimiter;
  /** Using a link. */
  token: RateLimiter;
}

/** Per IP and per minute (docs/cadrage.md, Sécurité). */
export const RATE_LIMITS = { signUp: 5, signIn: 10, email: 5, token: 10 } as const;
export const GAME_RATE_LIMITS = { start: 30, trial: 5, log: 10 } as const;

export function rateLimits(now: () => Date): RateLimits {
  const ms = () => now().getTime();
  return {
    signUp: rateLimiter(RATE_LIMITS.signUp, ms),
    signIn: rateLimiter(RATE_LIMITS.signIn, ms),
    email: rateLimiter(RATE_LIMITS.email, ms),
    token: rateLimiter(RATE_LIMITS.token, ms),
  };
}

export function gameRateLimits(now: () => Date): GameRateLimits {
  const ms = () => now().getTime();
  return {
    start: rateLimiter(GAME_RATE_LIMITS.start, ms),
    trial: rateLimiter(GAME_RATE_LIMITS.trial, ms),
    log: rateLimiter(GAME_RATE_LIMITS.log, ms),
  };
}
