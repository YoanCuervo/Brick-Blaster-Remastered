import type { GameData, ReplayLog } from "@brick-blaster/game/headless";
import { describe, expect, it } from "vitest";
// The engine's own test data: the asset pack is not in the repository.
import { Rng } from "../../../../packages/game/src/core/rng";
import { Difficulty } from "../../../../packages/game/src/data/config";
import { Game, GameMode, webConfig } from "../../../../packages/game/src/game/game";
import {
  EVERY_BRICK_ROW,
  shortLevel,
  testConfig,
} from "../../../../packages/game/src/game/playthrough.testdata";
import { GameRecorder } from "../../../../packages/game/src/game/replay";
import { SPARE_LIFE_POINTS } from "../../../../packages/game/src/game/score";
import { runReplay } from "./job";

const levels = Array.from({ length: 4 }, () => shortLevel(EVERY_BRICK_ROW));
const data: GameData = { config: testConfig, levels: { lv0: levels, lv1: levels, lv2: [] } };
const SEED = 99;

/** A player who serves, then leaves every ball, until `games` game overs. */
function giveUp(games: number): { log: ReplayLog; ticks: number; score: number } {
  const game = new Game(
    webConfig(testConfig, Difficulty.Medium),
    levels,
    Difficulty.Medium,
    new Rng(SEED),
    SPARE_LIFE_POINTS,
  );
  const recorder = new GameRecorder(game, SEED);
  let ticks = 0;
  let overs = 0;
  let score = 0;
  while (overs < games && ticks < 200_000) {
    // A release ends the wait after a game over (0x401FB4), a press serves the ball.
    recorder.tick({ paddleDx: -64, fire: game.mode === GameMode.Ready && ticks % 2 === 0 });
    ticks++;
    if (game.scoresDue) {
      game.scoresDue = false;
      score = game.player.score;
      overs++;
    }
  }
  return { log: recorder.log, ticks, score };
}

const job = (log: ReplayLog) => ({ world: "espace" as const, difficulty: 1 as const, log });

describe("the server's replay of one game", () => {
  const over = giveUp(1);

  it("gives the result of a game over, counters included", () => {
    expect(runReplay(data, job(over.log))).toEqual({
      kind: "game_over",
      score: over.score,
      level: 1,
      durationTicks: over.ticks,
      bricksBroken: expect.any(Number),
      livesLost: testConfig.nbsLife,
    });
  });

  it("takes a log without an end for a game left with Esc", () => {
    const left = runReplay(data, job({ ...over.log, ops: over.log.ops.slice(0, 3) }));
    expect(left.kind).toBe("left");
    expect(left.durationTicks).toBeLessThan(over.ticks);
  });

  it("refuses a log that goes on after its game over", () => {
    expect(() => runReplay(data, job({ ...over.log, ops: [...over.log.ops, [1, 0, 0]] }))).toThrow(
      "input after the end",
    );
    expect(() => runReplay(data, job(giveUp(2).log))).toThrow("input after the end");
  });
});
