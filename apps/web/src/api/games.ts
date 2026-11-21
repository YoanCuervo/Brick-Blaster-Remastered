import type {
  GameLogBody,
  GameResult,
  StartGameBody,
  StartGameReply,
} from "@brick-blaster/contracts";
import { GENERIC_ERROR, request, type Reply, type RequestError } from "./http";

/**
 * Games played on the site: the server gives the seed, then replays the log and answers with
 * its own result, the only one shown (docs/cadrage.md, Scores et classements).
 */

/** POST /api/games, signed in. */
export const startGame = (body: StartGameBody): Promise<Reply<StartGameReply>> =>
  request("POST", "/games", body);

/** POST /api/trial: the anonymous trial game, kept by a cookie until sign-up. */
export const startTrial = (): Promise<Reply<StartGameReply>> => request("POST", "/trial");

/** Sending a log again after a busy server or the rate limit: a lost log is a lost game. */
const LOG_ATTEMPTS = 3;
const DEFAULT_WAIT_SECONDS = 5;

const wait = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

/** POST /api/games/:id/log, sent again while the server asks to wait. */
export async function sendLog(id: number, log: GameLogBody): Promise<Reply<GameResult>> {
  for (let attempt = 1; ; attempt++) {
    const reply = await request<GameResult>("POST", `/games/${id}/log`, log);
    const retry = !reply.ok && (reply.error === "busy" || reply.error === "too_many_requests");
    if (!retry || attempt === LOG_ATTEMPTS) return reply;
    await wait(reply.retryAfterSeconds ?? DEFAULT_WAIT_SECONDS);
  }
}

/** The session expired: the page offers to sign in again. */
export const isSessionLost = (error: RequestError) => error === "unauthorized";

/** A neutral message for a game that could not start or be checked. */
export function gameErrorMessage(error: RequestError): string {
  switch (error) {
    case "unauthorized":
      return "Ta session a expiré : reconnecte-toi pour enregistrer tes parties.";
    case "replay_refused":
      return "Cette partie n'a pas pu être validée : son score n'est pas retenu.";
    case "too_many_requests":
      return "Trop de parties en peu de temps. Réessaie dans un instant.";
    case "busy":
      return "Le serveur est très occupé. Réessaie dans un instant.";
    default:
      return GENERIC_ERROR;
  }
}
