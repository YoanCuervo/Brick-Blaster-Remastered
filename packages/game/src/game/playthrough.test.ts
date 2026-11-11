// Whole games from the first level to the end, with a test-side player: V1 end criterion.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Rng } from "../core/rng";
import { Difficulty, type GameConfig, type Triplet, parseConfig } from "../data/config";
import { type Level, WORLD_LEVELS, parseLevels } from "../data/levels";
import { LIMBES_LEVELS } from "../data/limbesLevels";
import { BallState } from "./ball";
import { Game, GameMode, webConfig } from "./game";
import { EVERY_BRICK_ROW, shortLevel, testConfig } from "./playthrough.testdata";

/** Several hours of play for one level: beyond it, the level is considered stuck. */
const LEVEL_TICK_LIMIT = 500_000;
/**
 * Without a broken brick for this long, the player lets the ball go. At top speed, |dx| = 14
 * leaves no angle change (§4.2): between two rows of indestructible bricks, only a new ball helps.
 */
const STALL_TICKS = 15_000;
const SEEDS = Number(process.env["PLAYTHROUGH_SEEDS"] ?? 1);

interface Run {
  finished: boolean;
  /** Level where the run stopped, on failure. */
  level: number;
  gameOvers: number;
  /** Balls given up on, see STALL_TICKS. */
  stalls: number;
  longestLevel: number;
  score: number;
}

/**
 * Follows the lowest falling ball and picks a new part of the paddle for each descent, like a
 * player does: always the same one can settle into a loop the anti-loop never sees (§4.2).
 */
function play(
  config: GameConfig,
  levels: readonly Level[],
  difficulty: Difficulty,
  seed: number,
  quietTicks?: number,
): Run {
  const game = new Game(config, levels, difficulty, new Rng(seed));
  const player = new Rng(seed ^ 0x5a5a5a);
  const run: Run = { finished: false, level: 1, gameOvers: 0, stalls: 0, longestLevel: 0, score: 0 };
  let level = 0;
  let levelTicks = 0;
  let aim = 0.5;
  let tracked = false;
  let tick = 0;
  let bricks = -1;
  let lastBreak = 0;
  let stalled = false;
  const stallTicks = quietTicks ?? STALL_TICKS;
  const only = quietTicks === undefined ? null : config.startLevel;
  while (!game.finished && (only === null || game.level === only)) {
    if (game.level !== level) {
      level = game.level;
      levelTicks = 0;
    }
    run.longestLevel = Math.max(run.longestLevel, ++levelTicks);
    run.level = level;
    if (levelTicks > LEVEL_TICK_LIMIT) return run;
    const falling = game.balls
      .filter((b) => b.state === BallState.Active && b.dy >= 0)
      .sort((a, b) => b.y - a.y)[0];
    if (falling && !tracked) aim = (10 + player.rand(80)) / 100;
    tracked = falling !== undefined;
    const target = falling ? falling.x + falling.w / 2 - game.paddle.w * aim : game.paddle.x;
    const left = game.grid.cells.filter((c) => c >= 1 && c <= 7).length;
    if (left !== bricks || game.mode !== GameMode.Playing) {
      bricks = left;
      lastBreak = tick;
      stalled = false;
    }
    if (!stalled && tick - lastBreak > stallTicks) {
      stalled = true;
      run.stalls++;
    }
    const away = stalled && falling ? (falling.x < 320 ? 454 : 112) : null;
    const firing = game.mode === GameMode.Ready || tick % 8 === 0;
    game.tick({ paddleDx: Math.round((away ?? target) - game.paddle.x), fire: firing });
    if (game.scoresDue) {
      game.scoresDue = false;
      run.gameOvers++;
    }
    tick++;
  }
  run.finished = true;
  run.score = game.player.score;
  return run;
}

const DIFFICULTIES = [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard];

describe("a whole game", () => {
  it("reaches the end through every kind of brick", () => {
    const levels = Array.from({ length: 8 }, () => shortLevel(EVERY_BRICK_ROW));
    for (const difficulty of DIFFICULTIES) {
      const run = play(testConfig, levels, difficulty, 1);
      expect(run.finished).toBe(true);
      expect(run.score).toBeGreaterThan(0);
    }
  });
});

describe("the levels of Limbes", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`difficulty ${difficulty}: 50 levels, no stuck level`, () => {
      for (let seed = 1999; seed < 1999 + SEEDS; seed++) {
        const run = play(webConfig(testConfig, difficulty), LIMBES_LEVELS, difficulty, seed);
        if (SEEDS > 1) console.log("limbes", difficulty, seed, JSON.stringify(run));
        expect(run.finished, `stopped at level ${run.level}`).toBe(true);
      }
    }, 600_000);
  }
});

/**
 * A level where the ball settles into a circuit away from the last bricks: at high speed its two
 * angles are about the same, so the paddle hardly changes the course (§4.2). Limbes is held to
 * this, not the original: its worst level, the 14th of arcade, would fail.
 */
describe("the levels of Limbes, one by one", () => {
  const QUIET_TICKS = 3000;
  const RUNS = 6;
  const MAX_STALLS = 1;
  const web = webConfig(testConfig, Difficulty.Medium);
  it("rarely leave the ball with nothing to break for a minute", () => {
    const stallsOf = (i: number) => {
      let stalls = 0;
      for (let seed = 1001; seed <= 1000 + RUNS; seed++) {
        const config = { ...web, startLevel: i + 1 };
        stalls += play(config, LIMBES_LEVELS, Difficulty.Medium, seed, QUIET_TICKS).stalls;
      }
      return stalls;
    };
    const tooMany = LIMBES_LEVELS.map((_, i) => ({ level: i + 1, stalls: stallsOf(i) })).filter(
      (r) => r.stalls > MAX_STALLS,
    );
    expect(tooMany).toEqual([]);
  }, 600_000);

  /**
   * Not the original: a level of Limbes must not drag on for its last bricks. Without bonuses, so
   * that only the layout counts. With this player, the median level takes about 4 600 ticks in
   * space, 5 900 in arcade and 6 300 in Limbes; the slowest of arcade, 20 000.
   */
  it("end in under 10 000 ticks, in the median of a few games without bonuses", () => {
    const MAX_TICKS = 10_000;
    const quiet = { ...web, nbsLife: 99, timeBetweenOption: [1e9, 1e9, 1e9] as Triplet };
    const median = (i: number) => {
      const ticks = [];
      for (let seed = 1001; seed <= 1000 + RUNS; seed++) {
        const config = { ...quiet, startLevel: i + 1 };
        ticks.push(play(config, LIMBES_LEVELS, Difficulty.Medium, seed, STALL_TICKS).longestLevel);
      }
      return ticks.sort((a, b) => a - b)[RUNS >> 1]!;
    };
    const tooLong = LIMBES_LEVELS.map((_, i) => ({ level: i + 1, ticks: median(i) })).filter(
      (r) => r.ticks > MAX_TICKS,
    );
    expect(tooLong).toEqual([]);
  }, 600_000);
});

// The asset pack is never versioned: these run only where it has been extracted.
const packFile = (name: string): string =>
  fileURLToPath(new URL(`../../../../assets/${name}`, import.meta.url));
const packed = existsSync(packFile("levels.json")) && existsSync(packFile("config.json"));

describe.skipIf(!packed)("the original levels", () => {
  const read = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
  const config = packed ? parseConfig(read(packFile("config.json"))) : testConfig;
  const sets = packed ? parseLevels(read(packFile("levels.json"))) : null;

  for (const world of ["space", "arcade"] as const) {
    for (const difficulty of DIFFICULTIES) {
      it(`${world}, difficulty ${difficulty}: 40 levels, no stuck level`, () => {
        const levels = sets![WORLD_LEVELS[world] as "lv0" | "lv1"];
        expect(levels).toHaveLength(40);
        for (let seed = 1999; seed < 1999 + SEEDS; seed++) {
          const run = play(config, levels, difficulty, seed);
          if (SEEDS > 1) console.log(world, difficulty, seed, JSON.stringify(run));
          expect(run.finished).toBe(true);
        }
      }, 600_000);
    }
  }
});
