import type { DifficultyId, GameEndKind, WorldId } from "@brick-blaster/contracts";
import {
  type GameData,
  type ReplayLog,
  ReplayError,
  type World,
  parseGameData,
  replay,
  webReplaySetup,
} from "@brick-blaster/game/headless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** What one replay needs: the game as the server started it, and the client's log. */
export interface ReplayJob {
  world: WorldId;
  difficulty: DifficultyId;
  log: ReplayLog;
}

/** The server's own result: the only one that counts. */
export interface ReplayOutcome {
  kind: GameEndKind;
  score: number;
  level: number;
  durationTicks: number;
  bricksBroken: number;
  livesLost: number;
}

const ENGINE_WORLDS: Record<WorldId, World> = {
  espace: "space",
  arcade: "arcade",
  limbes: "limbes",
};

/** config.json and levels.json of the asset pack: the rules and levels the browser plays. */
export function loadGameData(dir: string): GameData {
  const json = (name: string): unknown => JSON.parse(readFileSync(join(dir, name), "utf8"));
  return parseGameData(json("config.json"), json("levels.json"));
}

/**
 * One log is one game: the server gave its seed for this game only, and a game over starts the
 * next one with a seed of its own (docs/cadrage.md, Stack V2). A log without an end is a game
 * left with Esc. Throws a ReplayError on any log a player cannot produce.
 */
export function runReplay(data: GameData, job: ReplayJob): ReplayOutcome {
  const setup = webReplaySetup(data, ENGINE_WORLDS[job.world], job.difficulty);
  const { ends, ticks, last } = replay(setup, job.log);
  if (ends.length > 1 || (ends[0] && ends[0].tick !== ticks)) {
    throw new ReplayError("input after the end");
  }
  const end = ends[0];
  const state = end ?? last;
  return {
    kind: end ? (end.kind === "gameOver" ? "game_over" : "finished") : "left",
    score: state.score,
    level: state.level,
    durationTicks: ticks,
    bricksBroken: state.bricksBroken,
    livesLost: state.livesLost,
  };
}
