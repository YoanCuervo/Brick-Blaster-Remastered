import {
  type DifficultyId,
  type Profile,
  errorReply,
  leaderboardParams,
  leaderboardReply,
  playerCardParams,
  playerCardQuery,
  playerCardReply,
  profileReply,
} from "@brick-blaster/contracts";
import type { FastifyInstance } from "fastify";
import { clearSessionCookie, findSession } from "../auth/sessions";
import type { GameDeps } from "./deps";

/**
 * Reading scores. The profile is its owner's only; the Limbes leaderboards and the hover card
 * of a ranked player are public (docs/cadrage.md, Scores et classements).
 */
export function scoreRoutes(app: FastifyInstance, deps: GameDeps): void {
  const { store, accounts, now } = deps;

  app.get(
    "/me/profile",
    { schema: { response: { 200: profileReply, 401: errorReply } } },
    async (req, res) => {
      const session = await findSession(accounts, req, now());
      const me = session && (await accounts.getMe(session.userId));
      if (!session || !me) {
        clearSessionCookie(res);
        return res.code(401).send({ error: "unauthorized" });
      }
      const profile: Profile = { ...me, ...(await store.profile(session.userId)) };
      return profile;
    },
  );

  app.get<{ Params: { difficulty: string } }>(
    "/leaderboard/:difficulty",
    { schema: { params: leaderboardParams, response: { 200: leaderboardReply } } },
    async (req) => {
      const session = await findSession(accounts, req, now());
      const difficulty = Number(req.params.difficulty) as DifficultyId;
      return store.leaderboard(difficulty, session?.userId ?? null);
    },
  );

  app.get<{ Params: { pseudo: string }; Querystring: { difficulty: string } }>(
    "/players/:pseudo",
    {
      schema: {
        params: playerCardParams,
        querystring: playerCardQuery,
        response: { 200: playerCardReply, 404: errorReply },
      },
    },
    async (req, res) => {
      const difficulty = Number(req.query.difficulty) as DifficultyId;
      const card = await store.playerCard(req.params.pseudo, difficulty);
      return card ?? res.code(404).send({ error: "not_found" });
    },
  );
}
