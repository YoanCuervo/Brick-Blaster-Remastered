import { describe, expect, it } from "vitest";
import { Rng } from "../core/rng";
import {
  BONUS_KEYS,
  Difficulty,
  type GameConfig,
  STATUS_KEYS,
  type Triplet,
} from "../data/config";
import { LEVEL_COLS, LEVEL_ROWS, type Level } from "../data/levels";
import { BallState } from "./ball";
import { FADE_STEPS } from "../render/fade";
import { Game, GameMode, serveSpeed, speedInterval } from "./game";

const t = (v: number): Triplet => [v, v, v];

function config(over: Partial<GameConfig> = {}): GameConfig {
  return {
    editorFlag: 0,
    extraLife: 10000,
    mouseSpeed: 0,
    nbsLife: 3,
    startLevel: 1,
    freqChangeSpeed: 1500,
    bonusFreq: Object.fromEntries(BONUS_KEYS.map((k) => [k, t(2)])) as GameConfig["bonusFreq"],
    timeBetweenOption: [6, 10, 12],
    freqCreateMonster: [600, 500, 400],
    startSpeed: [2, 3, 4],
    nbsChangeSpeedLevel: [2, 3, 3],
    texts: {
      status: Object.fromEntries(STATUS_KEYS.map((k) => [k, k])) as GameConfig["texts"]["status"],
      bonus: Object.fromEntries(BONUS_KEYS.map((k) => [k, k])) as GameConfig["texts"]["bonus"],
      menuBegin: ["", ""],
      menus: [],
      menuLast: ["", ""],
      final: [],
      finalDual: [],
    },
    ...over,
  };
}

/** Level with `bytes` on row 10 from column 0. */
function level(bytes: number[] = [0x21]): Level {
  return Array.from({ length: LEVEL_ROWS }, (_, r) =>
    Array.from({ length: LEVEL_COLS }, (_, c) => (r === 10 ? (bytes[c] ?? 0) : 0)),
  );
}

/** Load tick (0x407336) then one tick per fade step (0x406681). */
const FADE_IN_TICKS = 1 + FADE_STEPS;

/** Pads the set to 50 levels: the serve speed divides by levelCount / 3. */
function newGame(levels: Level[] = [level()], over: Partial<GameConfig> = {}, count = 50) {
  const set = [...levels];
  while (set.length < count) set.push(level());
  return new Game(config(over), set, Difficulty.Medium, new Rng(1));
}

/** A new game past its fade in, waiting for the serve. */
function game(levels?: Level[], over?: Partial<GameConfig>, count?: number) {
  const g = newGame(levels, over, count);
  for (let i = 0; i < FADE_IN_TICKS; i++) g.tick({ paddleDx: 0, fire: false });
  return g;
}

const idle = { paddleDx: 0, fire: false };
const fire = { paddleDx: 0, fire: true };

function ticks(g: Game, n: number, input = idle): void {
  for (let i = 0; i < n; i++) g.tick(input);
}

/** Sends the ball straight down past the paddle. */
function dropBall(g: Game): void {
  const b = g.balls[0]!;
  b.stuckOffset = null;
  b.x = 0x70 + 2;
  b.y = 440;
  b.dx = 0;
  b.dy = 3;
}

/** Ticks until the mode changes, returning how many were needed. */
function until(g: Game, mode: GameMode, input = idle, max = 1000): number {
  let n = 0;
  while (g.mode !== mode && n < max) {
    g.tick(input);
    n++;
  }
  return n;
}

describe("level speeds", () => {
  it("serves faster every levelCount / Nbs_Change_Speed_Level levels (0x40513F)", () => {
    expect(serveSpeed(3, 3, 1, 50)).toEqual({ dx: 3, dy: -4 });
    expect(serveSpeed(3, 3, 15, 50)).toEqual({ dx: 3, dy: -4 });
    expect(serveSpeed(3, 3, 16, 50)).toEqual({ dx: 4, dy: -5 });
    expect(serveSpeed(3, 3, 48, 50)).toEqual({ dx: 6, dy: -7 });
    expect(serveSpeed(2, 2, 25, 50)).toEqual({ dx: 3, dy: -4 });
  });

  it("speeds up sooner on each level (0x404DB4)", () => {
    expect(speedInterval(1500, 1)).toBe(1500);
    expect(speedInterval(1500, 3)).toBe(1466);
  });
});

describe("ready (0x405093)", () => {
  it("keeps the ball centred on the paddle until fire", () => {
    const g = game();
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.message).toBe("ready");
    ticks(g, 3, { paddleDx: 10, fire: false });
    const b = g.balls[0]!;
    expect(g.paddle.x).toBe(283 + 30);
    expect(b.x).toBe(g.paddle.x + 37 - 4);
    expect(b.y).toBe(0x1a0 - 9);
    expect(b.dx).toBe(0);
  });

  it("serves on fire and the ball leaves on the same tick", () => {
    const g = game();
    const b = g.balls[0]!;
    const x = b.x;
    g.tick(fire);
    expect(g.mode).toBe(GameMode.Playing);
    expect(g.message).toBe("off");
    expect(b.stuckOffset).toBeNull();
    expect([b.dx, b.dy]).toEqual([3, -4]);
    expect([b.x, b.y]).toEqual([x + 3, 0x1a0 - 9 - 4]);
  });
});

describe("bricks in play", () => {
  it("scores a destroyed brick and ends the level", () => {
    const g = game([level([0x21, 0x21]), level()]);
    g.tick(fire);
    const b = g.balls[0]!;
    b.x = 0x70 + 10;
    b.y = 177;
    b.dx = 0;
    b.dy = -3;
    g.tick(idle);
    expect(g.player.score).toBe(20);
    expect(g.sounds).toContain("bounce");
    expect(b.dy).toBe(3);
    expect(g.mode).toBe(GameMode.Playing);
  });

  it("sends the ball through a teleporter, reversed", () => {
    const g = game([level([0x18, 0x21]), level()]);
    g.tick(fire);
    const b = g.balls[0]!;
    b.x = 0x70 + 10;
    b.y = 177;
    b.dx = 0;
    b.dy = -3;
    g.tick(idle);
    expect(g.sounds).toContain("telepod");
    expect(b.dy).toBe(3);
    expect(b.x).toBeGreaterThanOrEqual(212);
    expect(b.x).toBeLessThanOrEqual(428);
  });
});

describe("level end (0x4045B2, 0x401C54)", () => {
  it("plays the warp, waits 4 ticks, then loads the next level", () => {
    const g = game([level([]), level([0x21, 0x24])]);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.LevelEnd);
    expect(g.sounds).toEqual(["next"]);
    expect(g.balls.every((b) => b.state === BallState.Dead)).toBe(true);
    // 18 animation ticks, the 18th still visible, then 4 ticks hidden.
    ticks(g, 18);
    expect(g.paddleAnim?.visible).toBe(true);
    expect(g.level).toBe(1);
    ticks(g, 3);
    expect(g.paddleAnim?.visible).toBe(false);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.FadeOut);
  });

  it("fades out, loads the background, fades in, then starts the round", () => {
    const g = game([level([]), level([0x21, 0x24])]);
    until(g, GameMode.FadeOut);
    const seen: number[] = [];
    for (let i = 0; i < FADE_STEPS; i++) {
      g.tick(idle);
      seen.push(g.fade);
    }
    expect(seen).toEqual(Array.from({ length: FADE_STEPS }, (_, k) => k));
    expect(g.bare).toBe(false);
    expect(g.paddleAnim?.visible).toBe(false);
    expect(g.level).toBe(1);
    expect(g.mode).toBe(GameMode.FadeIn);
    // Load tick, still dark, background only.
    g.tick(idle);
    expect([g.bare, g.fade, g.level]).toEqual([true, FADE_STEPS - 1, 2]);
    const back: number[] = [];
    for (let i = 0; i < FADE_STEPS; i++) {
      expect(g.mode).toBe(GameMode.FadeIn);
      g.tick(idle);
      back.push(g.fade);
    }
    expect(back).toEqual(Array.from({ length: FADE_STEPS }, (_, k) => FADE_STEPS - 1 - k));
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.bare).toBe(false);
    expect(g.paddleAnim).toBeNull();
    expect(g.grid.cells[130]).toBe(1);
    expect(g.paddle.x).toBe(283);
  });

  it("ends the game after the last level without the warp", () => {
    const g = game([level([])], {}, 1);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.Finished);
    expect(g.paddleAnim).toBeNull();
  });
});

describe("lost life (0x404A38, 0x404AED)", () => {
  it("explodes the paddle, waits, then serves again on the same grid", () => {
    const g = game([level([0x24, 0x21]), level()]);
    g.tick(fire);
    g.grid.cells[13 * 10] = 2;
    dropBall(g);
    const n = until(g, GameMode.LifeLost);
    expect(g.sounds).toEqual(expect.arrayContaining(["pertebal", "boom", "death"]));
    expect(n).toBeGreaterThan(1);
    expect(g.player.lives).toBe(1);
    expect(g.livesShown).toBe(2);
    expect(g.message).toBe("again");
    // 35 animation ticks, then 75 with the paddle hidden.
    ticks(g, 109);
    expect(g.mode).toBe(GameMode.LifeLost);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.message).toBe("ready");
    expect(g.sounds).toEqual(["restart"]);
    expect(g.livesShown).toBe(1);
    expect(g.grid.cells[13 * 10]).toBe(2);
  });

  it("ends in game over after the last life, then fire starts a new game", () => {
    const g = game([level([0x21, 0x21]), level()], { nbsLife: 1 });
    g.tick(fire);
    g.player.score = 500;
    dropBall(g);
    until(g, GameMode.GameOver);
    expect(g.message).toBe("over");
    expect(g.player.lives).toBe(-1);
    ticks(g, 110);
    expect(g.mode).toBe(GameMode.GameOverWait);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.GameOverWait);
    g.tick(fire);
    // 0x401FB4 goes back to 0x401D4C: no fade out, background load and fade in.
    expect(g.mode).toBe(GameMode.FadeIn);
    expect(g.bare).toBe(true);
    expect(g.player).toEqual({ score: 0, lives: 0, nextLife: 10000 });
    ticks(g, FADE_IN_TICKS);
    expect(g.mode).toBe(GameMode.Ready);
  });
});

describe("extra life (0x40600B)", () => {
  it("is checked while playing only", () => {
    const g = game();
    g.player.score = 10000;
    g.tick(idle);
    expect(g.player.lives).toBe(2);
    g.tick(fire);
    expect(g.player.lives).toBe(2);
    g.tick(idle);
    expect(g.player.lives).toBe(3);
    expect(g.livesShown).toBe(3);
    expect(g.player.score).toBe(10090);
    expect(g.message).toBe("new_life");
    expect(g.sounds).toContain("newlife");
  });
});

describe("new game (0x401D4C)", () => {
  it("starts on the bare background, dark, and fades in", () => {
    const g = newGame();
    expect([g.mode, g.bare, g.fade]).toEqual([GameMode.FadeIn, true, FADE_STEPS - 1]);
    ticks(g, FADE_IN_TICKS - 1);
    expect(g.mode).toBe(GameMode.FadeIn);
    g.tick(fire);
    // Fire during the fade does not serve.
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.message).toBe("ready");
  });
});
