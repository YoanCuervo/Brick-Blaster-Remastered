import type { PasswordHasher } from "../auth/password";
import { type RateLimiter, rateLimiter } from "../http/rateLimit";
import type { Mailer } from "../mail/mailer";
import type { AccountStore } from "../store/accounts";

/** What the account routes are built from: the server passes the real ones, tests fakes. */
export interface AccountDeps {
  store: AccountStore;
  hasher: PasswordHasher;
  mailer: Mailer;
  /** Origin of the website, for the links of the emails. */
  siteUrl: string;
  now: () => Date;
  limits: RateLimits;
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

export function rateLimits(now: () => Date): RateLimits {
  const ms = () => now().getTime();
  return {
    signUp: rateLimiter(RATE_LIMITS.signUp, ms),
    signIn: rateLimiter(RATE_LIMITS.signIn, ms),
    email: rateLimiter(RATE_LIMITS.email, ms),
    token: rateLimiter(RATE_LIMITS.token, ms),
  };
}
