import {
  type EmailBody,
  type ResetPasswordBody,
  type SignInBody,
  type SignUpBody,
  type TokenBody,
  emailBody,
  meReply,
  resetPasswordBody,
  signInBody,
  signUpBody,
  tokenBody,
} from "@brick-blaster/contracts";
import type { FastifyInstance, FastifyReply } from "fastify";
import { provisionalPseudo } from "../account/pseudo";
import { clearSessionCookie, findSession, startSession } from "../auth/sessions";
import { afterFailure, lockSeconds } from "../auth/throttle";
import { newToken, normalizeEmail, sha256 } from "../auth/tokens";
import { clearTrialCookie, trialIdOf } from "../auth/trial";
import { limitByIp } from "../http/rateLimit";
import type { Mail } from "../mail/mailer";
import { alreadyRegisteredMail, resetPasswordMail, verifyEmailMail } from "../mail/templates";
import type { TokenPurpose } from "../store/accounts";
import type { AccountDeps } from "./deps";

export const VERIFY_EMAIL_TTL_MS = 24 * 3600_000;
export const RESET_PASSWORD_TTL_MS = 3600_000;
/** Attempts at a free provisional pseudo before giving up on a sign-up. */
const PSEUDO_TRIES = 5;

/** Paths of the website pages the emails link to (apps/web/src/routes.ts). */
export const SITE_PATHS = {
  verifyEmail: "/verification-email",
  resetPassword: "/nouveau-mot-de-passe",
  signIn: "/connexion",
  forgotPassword: "/mot-de-passe-oublie",
} as const;

export function authRoutes(app: FastifyInstance, deps: AccountDeps): void {
  const { store, hasher, now, limits } = deps;
  const link = (path: string, token?: string) =>
    `${deps.siteUrl}${path}${token ? `?token=${token}` : ""}`;

  /**
   * Sent without waiting: how long Brevo takes must not tell whether an account exists. A
   * failure is logged without the address or the link.
   */
  const send = (mail: Mail) => {
    deps.mailer.send(mail).catch((error: unknown) => {
      app.log.error(
        { reason: error instanceof Error ? error.message : "unknown" },
        "email not sent",
      );
    });
  };

  const issueToken = async (userId: number, purpose: TokenPurpose, ttl: number) => {
    const token = newToken();
    await store.createToken({
      hash: sha256(token),
      userId,
      purpose,
      expiresAt: new Date(now().getTime() + ttl),
    });
    return token;
  };

  const sendVerification = async (userId: number, email: string) => {
    const token = await issueToken(userId, "verify_email", VERIFY_EMAIL_TTL_MS);
    send(verifyEmailMail(email, link(SITE_PATHS.verifyEmail, token)));
  };

  const accepted = (res: FastifyReply) => res.code(202).send({});

  app.post<{ Body: SignUpBody }>(
    "/auth/sign-up",
    { schema: { body: signUpBody }, preHandler: limitByIp(limits.signUp) },
    async (req, res) => {
      const email = normalizeEmail(req.body.email);
      // Hashed whatever happens next, so that a taken email answers in the same time.
      const passwordHash = await hasher.hash(req.body.password);
      const existing = await store.findUserByEmail(email);
      if (existing) {
        if (existing.emailVerified) {
          send(
            alreadyRegisteredMail(email, link(SITE_PATHS.signIn), link(SITE_PATHS.forgotPassword)),
          );
        } else {
          await sendVerification(existing.id, email);
        }
        return accepted(res);
      }
      for (let i = 0; i < PSEUDO_TRIES; i++) {
        const created = await store.createUser({
          email,
          passwordHash,
          pseudo: provisionalPseudo(),
          createdAt: now(),
        });
        if ("id" in created) {
          // docs/cadrage.md, Parcours: the trial score enters the new account's tables.
          const trialId = trialIdOf(req);
          if (trialId) {
            await deps.trials.claimTrial(sha256(trialId), created.id);
            clearTrialCookie(res);
          }
          await sendVerification(created.id, email);
          return accepted(res);
        }
        // Signed up twice at once: the other request sends the email.
        if (created.taken === "email") return accepted(res);
      }
      throw new Error("no free provisional pseudo");
    },
  );

  app.post<{ Body: TokenBody }>(
    "/auth/verify-email",
    { schema: { body: tokenBody }, preHandler: limitByIp(limits.token) },
    async (req, res) => {
      const userId = await store.consumeToken(sha256(req.body.token), "verify_email", now());
      if (userId === null) return res.code(400).send({ error: "invalid_token" });
      await store.markEmailVerified(userId, now());
      return res.code(204).send();
    },
  );

  app.post<{ Body: EmailBody }>(
    "/auth/resend-verification",
    { schema: { body: emailBody }, preHandler: limitByIp(limits.email) },
    async (req, res) => {
      const email = normalizeEmail(req.body.email);
      const user = await store.findUserByEmail(email);
      if (user && !user.emailVerified) await sendVerification(user.id, email);
      return accepted(res);
    },
  );

  app.post<{ Body: SignInBody }>(
    "/auth/sign-in",
    {
      schema: { body: signInBody, response: { 200: meReply } },
      preHandler: limitByIp(limits.signIn),
    },
    async (req, res) => {
      const email = normalizeEmail(req.body.email);
      // Keyed by the email typed, registered or not: a lock tells nothing about accounts.
      const emailHash = sha256(email);
      const throttle = await store.getThrottle(emailHash);
      const locked = lockSeconds(throttle, now());
      // During a lock the password is not even tried: it cannot be guessed meanwhile.
      if (locked > 0) return res.code(429).send({ error: "locked", retryAfterSeconds: locked });

      const user = await store.findUserByEmail(email);
      let valid = false;
      if (user) valid = await hasher.verify(req.body.password, user.passwordHash);
      else await hasher.verifyNothing(req.body.password);

      if (!valid || !user) {
        const next = afterFailure(throttle, now());
        await store.setThrottle(emailHash, next);
        const seconds = lockSeconds(next, now());
        if (seconds > 0 && next.failures === 0) {
          return res.code(429).send({ error: "locked", retryAfterSeconds: seconds });
        }
        return res.code(401).send({ error: "invalid_credentials" });
      }
      await store.clearThrottle(emailHash);
      // Said only to whoever knows the password: it proves nothing about other accounts.
      if (!user.emailVerified) return res.code(403).send({ error: "email_not_verified" });
      const me = await store.getMe(user.id);
      await startSession(store, res, user.id, now());
      return me;
    },
  );

  app.post("/auth/sign-out", async (req, res) => {
    const session = await findSession(store, req, now());
    if (session) await store.deleteSession(session.idHash);
    clearSessionCookie(res);
    return res.code(204).send();
  });

  app.post<{ Body: EmailBody }>(
    "/auth/forgot-password",
    { schema: { body: emailBody }, preHandler: limitByIp(limits.email) },
    async (req, res) => {
      const email = normalizeEmail(req.body.email);
      const user = await store.findUserByEmail(email);
      if (user) {
        const token = await issueToken(user.id, "reset_password", RESET_PASSWORD_TTL_MS);
        send(resetPasswordMail(email, link(SITE_PATHS.resetPassword, token)));
      }
      return accepted(res);
    },
  );

  app.post<{ Body: ResetPasswordBody }>(
    "/auth/reset-password",
    { schema: { body: resetPasswordBody }, preHandler: limitByIp(limits.token) },
    async (req, res) => {
      const userId = await store.consumeToken(sha256(req.body.token), "reset_password", now());
      if (userId === null) return res.code(400).send({ error: "invalid_token" });
      await store.setPasswordHash(userId, await hasher.hash(req.body.password));
      // The link reached the mailbox: the address is proven as well.
      await store.markEmailVerified(userId, now());
      await store.deleteUserSessions(userId);
      return res.code(204).send();
    },
  );
}
