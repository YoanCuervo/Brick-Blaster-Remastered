import {
  type AvatarBody,
  type ChangePasswordBody,
  type PseudoBody,
  RESERVED_PSEUDO,
  avatarBody,
  changePasswordBody,
  deleteAccountBody,
  errorReply,
  meReply,
  pseudoBody,
} from "@brick-blaster/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { isRefusedPseudo } from "../account/pseudo";
import {
  type CurrentSession,
  clearSessionCookie,
  findSession,
  startSession,
} from "../auth/sessions";
import { limitByIp } from "../http/rateLimit";
import type { AccountDeps } from "./deps";

/** The signed-in player's own account. Every route here needs a live session. */
export function meRoutes(app: FastifyInstance, deps: AccountDeps): void {
  const { store, hasher, now } = deps;
  const sessions = new WeakMap<FastifyRequest, CurrentSession>();
  const session = (req: FastifyRequest) => sessions.get(req)!;

  app.register(async (me) => {
    me.addHook("preHandler", async (req: FastifyRequest, res: FastifyReply) => {
      const current = await findSession(store, req, now());
      if (!current) {
        clearSessionCookie(res);
        return res.code(401).send({ error: "unauthorized" });
      }
      sessions.set(req, current);
    });

    me.get("/me", { schema: { response: { 200: meReply, 401: errorReply } } }, async (req, res) => {
      const found = await store.getMe(session(req).userId);
      return found ?? res.code(401).send({ error: "unauthorized" });
    });

    me.put<{ Body: PseudoBody }>(
      "/me/pseudo",
      { schema: { body: pseudoBody } },
      async (req, res) => {
        const { pseudo } = req.body;
        if (RESERVED_PSEUDO.test(pseudo) || isRefusedPseudo(pseudo)) {
          return res.code(422).send({ error: "pseudo_refused" });
        }
        if (!(await store.setPseudo(session(req).userId, pseudo))) {
          return res.code(409).send({ error: "pseudo_taken" });
        }
        return res.code(204).send();
      },
    );

    me.put<{ Body: AvatarBody }>(
      "/me/avatar",
      { schema: { body: avatarBody } },
      async (req, res) => {
        await store.setAvatar(session(req).userId, req.body.avatar);
        return res.code(204).send();
      },
    );

    me.put<{ Body: ChangePasswordBody }>(
      "/me/password",
      // A stolen session must not become a free guess at the password.
      { schema: { body: changePasswordBody }, preHandler: limitByIp(deps.limits.signIn) },
      async (req, res) => {
        const { userId } = session(req);
        const stored = await store.findPasswordHash(userId);
        if (!stored || !(await hasher.verify(req.body.currentPassword, stored))) {
          return res.code(401).send({ error: "invalid_credentials" });
        }
        await store.setPasswordHash(userId, await hasher.hash(req.body.newPassword));
        // Every other device is signed out; this one gets a fresh session.
        await store.deleteUserSessions(userId);
        await startSession(store, res, userId, now());
        return res.code(204).send();
      },
    );

    me.delete("/me", { schema: { body: deleteAccountBody } }, async (req, res) => {
      await store.deleteUser(session(req).userId);
      clearSessionCookie(res);
      return res.code(204).send();
    });
  });
}
