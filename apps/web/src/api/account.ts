import type {
  EmailBody,
  Me,
  ResetPasswordBody,
  SignInBody,
  SignUpBody,
  TokenBody,
} from "@brick-blaster/contracts";
import { request, type Reply } from "./http";

/** /api/auth routes. Sign-up and both email requests always answer 202: nothing leaks. */

export const signUp = (body: SignUpBody): Promise<Reply<void>> =>
  request("POST", "/auth/sign-up", body);

export const signIn = (body: SignInBody): Promise<Reply<Me>> =>
  request("POST", "/auth/sign-in", body);

export const resendVerification = (email: string): Promise<Reply<void>> =>
  request("POST", "/auth/resend-verification", { email } satisfies EmailBody);

export const requestPasswordReset = (email: string): Promise<Reply<void>> =>
  request("POST", "/auth/forgot-password", { email } satisfies EmailBody);

export const resetPassword = (body: ResetPasswordBody): Promise<Reply<void>> =>
  request("POST", "/auth/reset-password", body);

// A token works once: StrictMode's second effect run must reuse the first call, not send another.
const verifications = new Map<string, Promise<Reply<void>>>();

export function verifyEmail(token: string): Promise<Reply<void>> {
  let pending = verifications.get(token);
  if (!pending) {
    pending = request("POST", "/auth/verify-email", { token } satisfies TokenBody);
    verifications.set(token, pending);
  }
  return pending;
}
