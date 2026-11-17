import { DEMO_ACCOUNT, EXPIRED_RESET_TOKEN } from "../fixtures/account";

/*
 * Fake account API: same signatures and answers as the future `/api` routes, backed by
 * fixtures. Only this file changes when the auth routes exist.
 */

export type SignInResult =
  | { ok: true }
  | { ok: false; error: "invalid" }
  | { ok: false; error: "locked"; retryAfterSeconds: number };
export type ResetPasswordResult = { ok: true } | { ok: false; error: "invalid-token" };

const FAILURES_BEFORE_LOCK = 5;
// Progressive lock of the scope (docs/cadrage.md, Sécurité): 1, 5, then 15 minutes.
const LOCK_MINUTES = [1, 5];
const MAX_LOCK_MINUTES = 15;

let failures = 0;
let locks = 0;
let lockedUntil = 0;

const latency = () => new Promise((resolve) => setTimeout(resolve, 300));

/** Always succeeds: an email already registered gets a notice, never an error on screen. */
export const signUp: (input: { email: string; password: string }) => Promise<void> = async () => {
  await latency();
};

export async function signIn(input: { email: string; password: string }): Promise<SignInResult> {
  await latency();
  const now = Date.now();
  if (now < lockedUntil) {
    return { ok: false, error: "locked", retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000) };
  }
  const valid =
    input.email.trim().toLowerCase() === DEMO_ACCOUNT.email &&
    input.password === DEMO_ACCOUNT.password;
  if (valid) {
    failures = 0;
    locks = 0;
    return { ok: true };
  }
  failures += 1;
  if (failures < FAILURES_BEFORE_LOCK) return { ok: false, error: "invalid" };
  const minutes = LOCK_MINUTES[locks] ?? MAX_LOCK_MINUTES;
  failures = 0;
  locks += 1;
  lockedUntil = now + minutes * 60_000;
  return { ok: false, error: "locked", retryAfterSeconds: minutes * 60 };
}

/** Always succeeds: the answer must not reveal whether the email is registered. */
export const requestPasswordReset: (email: string) => Promise<void> = async () => {
  await latency();
};

export async function resetPassword(input: {
  token: string;
  password: string;
}): Promise<ResetPasswordResult> {
  await latency();
  return input.token === EXPIRED_RESET_TOKEN ? { ok: false, error: "invalid-token" } : { ok: true };
}
