import type { GameResult, StartGameReply, WorldId } from "@brick-blaster/contracts";
import type { Difficulty, GameEndReport, World } from "@brick-blaster/game/mount";
import { useRef, useState } from "react";
import { sendLog } from "../api/games";
import type { Reply, RequestError } from "../api/http";

/** The engine's world ids are its own, the site's are French. */
export const SITE_WORLDS: Record<World, WorldId> = {
  space: "espace",
  arcade: "arcade",
  limbes: "limbes",
};

export interface EngineGame {
  world: World;
  difficulty: Difficulty;
}

/** Where the last game sent to the server stands. */
export type GameOutcome =
  | { state: "checking" }
  | { state: "done"; result: GameResult }
  | { state: "failed"; error: RequestError };

/**
 * Plays every solo game of the frame through the server: `start` gets its seed, and each end
 * sends the log, whose replay gives the only result the page shows.
 */
export function useServerGames(start: (game: EngineGame) => Promise<Reply<StartGameReply>>) {
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  /** The game being played: the engine plays one at a time. */
  const gameId = useRef<number | null>(null);

  const newSeed = async (game: EngineGame): Promise<number> => {
    gameId.current = null;
    const reply = await start(game);
    if (!reply.ok) {
      setOutcome({ state: "failed", error: reply.error });
      throw new Error(reply.error);
    }
    gameId.current = reply.data.id;
    return reply.data.seed;
  };

  const onGameEnd = (report: GameEndReport) => {
    const id = gameId.current;
    // A coop game has no log, and is not the server's.
    if (report.log === null || id === null) return;
    gameId.current = null;
    setOutcome({ state: "checking" });
    void sendLog(id, report.log).then((reply) =>
      setOutcome(
        reply.ok ? { state: "done", result: reply.data } : { state: "failed", error: reply.error },
      ),
    );
  };

  return { newSeed, onGameEnd, outcome };
}
