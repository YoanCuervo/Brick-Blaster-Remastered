import {
  type GameLogBody,
  type GameResult,
  LOG_MAX_BYTES,
  type StartGameBody,
  TICKS_PER_SECOND,
  TRIAL_GAME,
  errorReply,
  gameIdParams,
  gameLogBody,
  gameResultReply,
  startGameBody,
  startGameReply,
} from "@brick-blaster/contracts";
import type { ReplayLog } from "@brick-blaster/game/headless";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomInt } from "node:crypto";
import { gzipSync } from "node:zlib";
import { findSession } from "../auth/sessions";
import { newToken, sha256 } from "../auth/tokens";
import { TRIAL_TTL_MS, setTrialCookie, trialIdOf } from "../auth/trial";
import { limitByIp } from "../http/rateLimit";
import type { ReplayOutcome } from "../replay/job";
import { ReplayBusy, ReplayRefused } from "../replay/pool";
import type { StoredGame } from "../store/games";
import type { GameDeps } from "./deps";

/** A log may not hold more ticks than the time it had, give or take a clock that runs fast. */
export const CLOCK_SLACK = 1.05;
export const SLACK_TICKS = 60;
/** Seconds a client waits before sending a log again when every replay slot is taken. */
export const BUSY_RETRY_SECONDS = 5;

/** A fresh unsigned 32-bit seed for every game: the client never picks it. */
export const newSeed = (): number => randomInt(0, 2 ** 32);

/** Starting games and sending their logs (docs/cadrage.md, Scores et classements). */
export function gameRoutes(app: FastifyInstance, deps: GameDeps): void {
  const { store, now, limits } = deps;
  const userOf = async (req: FastifyRequest) =>
    (await findSession(deps.accounts, req, now()))?.userId ?? null;

  app.post<{ Body: StartGameBody }>(
    "/games",
    {
      schema: { body: startGameBody, response: { 201: startGameReply } },
      preHandler: limitByIp(limits.start),
    },
    async (req, res) => {
      const userId = await userOf(req);
      if (userId === null) return res.code(401).send({ error: "unauthorized" });
      const { world, difficulty, ranked } = req.body;
      if (ranked && world !== "limbes") return res.code(400).send({ error: "bad_request" });
      const seed = deps.newSeed();
      const id = await store.startGame(
        { userId },
        { world, difficulty, ranked, seed, startedAt: now() },
      );
      return res.code(201).send({ id, seed });
    },
  );

  // A new trial replaces the browser's previous one: going back home is the way to play again.
  app.post(
    "/trial",
    { schema: { response: { 201: startGameReply } }, preHandler: limitByIp(limits.trial) },
    async (req, res) => {
      const previous = trialIdOf(req);
      if (previous) await store.deleteTrial(sha256(previous));
      const trialId = newToken();
      const trialHash = sha256(trialId);
      await store.createTrial(trialHash, new Date(now().getTime() + TRIAL_TTL_MS));
      const seed = deps.newSeed();
      const id = await store.startGame({ trialHash }, { ...TRIAL_GAME, seed, startedAt: now() });
      setTrialCookie(res, trialId);
      return res.code(201).send({ id, seed });
    },
  );

  /** The game of this id, if the request's session or trial owns it. */
  const ownGame = async (req: FastifyRequest, id: number): Promise<StoredGame | null> => {
    const game = await store.findGame(id);
    if (!game) return null;
    if (game.userId !== null) return game.userId === (await userOf(req)) ? game : null;
    const trialId = trialIdOf(req);
    if (!trialId || !game.trialHash?.equals(sha256(trialId))) return null;
    return (await store.isLiveTrial(game.trialHash, now())) ? game : null;
  };

  const refuse = async (res: FastifyReply, game: StoredGame, reason: string) => {
    res.log.info({ game: game.id, reason }, "replay refused");
    await store.dropGame(game.id);
    return res.code(422).send({ error: "replay_refused" });
  };

  app.post<{ Params: { id: string }; Body: GameLogBody }>(
    "/games/:id/log",
    {
      bodyLimit: LOG_MAX_BYTES,
      schema: {
        params: gameIdParams,
        body: gameLogBody,
        response: { 200: gameResultReply, 422: errorReply },
      },
      preHandler: limitByIp(limits.log),
    },
    async (req, res) => {
      const game = await ownGame(req, Number(req.params.id));
      if (!game) return res.code(404).send({ error: "not_found" });
      if (game.status !== "started") return res.code(409).send({ error: "game_closed" });
      const log = req.body as ReplayLog;
      if (log.seed !== game.seed) return refuse(res, game, "not the server's seed");

      let outcome: ReplayOutcome;
      try {
        outcome = await deps.replayer.run({ world: game.world, difficulty: game.difficulty, log });
      } catch (error: unknown) {
        if (error instanceof ReplayRefused) return refuse(res, game, error.message);
        if (error instanceof ReplayBusy) {
          return res
            .code(503)
            .header("retry-after", String(BUSY_RETRY_SECONDS))
            .send({ error: "busy" });
        }
        throw error;
      }
      const elapsedMs = now().getTime() - game.startedAt.getTime();
      const allowed = (elapsedMs / 1000) * TICKS_PER_SECOND * CLOCK_SLACK + SLACK_TICKS;
      if (outcome.durationTicks > allowed) return refuse(res, game, "more ticks than time");

      // Only a ranked log may be kept: compressing the others would be wasted work.
      const kept = game.ranked ? gzipSync(JSON.stringify(log)) : Buffer.alloc(0);
      const saved = await store.endGame(game.id, { ...outcome, endedAt: now() }, kept);
      if (!saved) return res.code(409).send({ error: "game_closed" });
      const result: GameResult = {
        kind: outcome.kind,
        score: outcome.score,
        level: outcome.level,
        durationSeconds: Math.round(outcome.durationTicks / TICKS_PER_SECOND),
        rank: saved.rank,
      };
      return result;
    },
  );
}
