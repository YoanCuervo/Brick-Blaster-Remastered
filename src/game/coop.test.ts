// Coop mode of the original (§4.6).
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
import { FADE_STEPS } from "../render/fade";
import { BallState, createBall } from "./ball";
import { type BonusDef, bonusByKey, spawnCapsule } from "./bonus";
import { Game, GameMode, type GameInput, type Partner } from "./game";
import { PLAYER1_START_X, PLAYER2_START_X } from "./paddle";

const t = (v: number): Triplet => [v, v, v];

function config(): GameConfig {
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
  };
}

/** Bricks on row 10 from column 0, out of reach of a ball held on a paddle. */
function level(bytes: number[] = [0x24]): Level {
  return Array.from({ length: LEVEL_ROWS }, (_, r) =>
    Array.from({ length: LEVEL_COLS }, (_, c) => (r === 10 ? (bytes[c] ?? 0) : 0)),
  );
}

/** Load tick, fade in, then the paddles' arrival (0x404B88). */
const READY_TICKS = 1 + FADE_STEPS + 18;
const idle: GameInput = { paddleDx: 0, fire: false };
const fire: GameInput = { paddleDx: 0, fire: true };
const fire2: GameInput = { paddleDx: 0, fire: false, fire2: true };

function coop(partner: Partner = "keyboard", levels: Level[] = [level()]): Game {
  const set = [...levels];
  while (set.length < 40) set.push(level());
  const g = new Game(config(), set, Difficulty.Medium, new Rng(1), 0, partner);
  ticks(g, READY_TICKS);
  return g;
}

function ticks(g: Game, n: number, input = idle): void {
  for (let i = 0; i < n; i++) g.tick(input);
}

/** Serves, then keeps both balls on their paddles, out of every brick's way. */
function served(partner: Partner = "keyboard"): Game {
  const g = coop(partner);
  g.tick(fire);
  for (const b of g.balls) b.stuckOffset = 10;
  g.balls[1]!.stuckTo = 1;
  g.magnet.on = true;
  g.magnet2.on = true;
  return g;
}

/** A capsule caught by player `seat` on the next tick; its routine runs on the one after. */
function caughtBy(g: Game, seat: 0 | 1, key: Parameters<typeof bonusByKey>[0]): void {
  const paddle = seat === 0 ? g.paddle : g.paddle2!;
  spawnCapsule(g.capsules, bonusByKey(key), paddle.x, 414);
  ticks(g, 2);
}

const keys = (slots: readonly (BonusDef | null)[]) => slots.map((b) => b?.key ?? null);

describe("start of a round (0x40256C, 0x4037C9)", () => {
  it("puts player 1 right, player 2 left, each with a ball stuck on their paddle", () => {
    const g = coop();
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.paddle.x).toBe(PLAYER1_START_X);
    expect(g.paddle2!.x).toBe(PLAYER2_START_X);
    expect(g.balls.map((b) => [b.owner, b.state])).toEqual([
      [0, BallState.Active],
      [1, BallState.Active],
    ]);
    expect(g.balls[1]!.x).toBe(PLAYER2_START_X + 37 - 4);
    expect(g.balls[1]!.stuckTo).toBe(1);
  });

  it("brings both paddles in, then shows them", () => {
    const set = Array.from({ length: 40 }, () => level());
    const g = new Game(config(), set, Difficulty.Medium, new Rng(1), 0, "keyboard");
    ticks(g, 1 + FADE_STEPS + 1);
    expect(g.mode).toBe(GameMode.Arrival);
    expect(g.paddleAnim2!.x).toBe(PLAYER2_START_X - 9);
  });
});

describe("serve (0x405093, 0x405172)", () => {
  it("serves player 2's ball to the left, at the same speed", () => {
    const g = coop("computer");
    g.tick(fire);
    expect(g.mode).toBe(GameMode.Playing);
    expect([g.balls[0]!.dx, g.balls[0]!.dy]).toEqual([3, -4]);
    expect([g.balls[1]!.dx, g.balls[1]!.dy]).toEqual([-3, -4]);
  });

  it("keeps each ball on its paddle until its own player fires (0x403DB3, 0x403DC8)", () => {
    const g = coop();
    g.tick(fire);
    expect(g.balls[0]!.stuckOffset).toBeNull();
    expect(g.balls[1]!.stuckOffset).not.toBeNull();
    g.tick({ ...idle, paddle2Dx: 10 });
    expect(g.balls[1]!.x).toBe(g.paddle2!.x + g.balls[1]!.stuckOffset!);
    g.tick(fire2);
    expect(g.balls[1]!.stuckOffset).toBeNull();
    expect(g.magnet2.on).toBe(false);
  });

  it("serves on player 2's fire too (0x406FE1)", () => {
    const g = coop();
    g.tick(fire2);
    expect(g.mode).toBe(GameMode.Playing);
    expect(g.balls[0]!.stuckOffset).not.toBeNull();
  });

  it("waits for player 1 with the computer as player 2", () => {
    const g = coop("computer");
    g.tick(fire2);
    expect(g.mode).toBe(GameMode.Ready);
  });
});

describe("lives (0x404A38)", () => {
  /** Sends player 2's ball straight down, away from both paddles. */
  function drop(g: Game): void {
    const b = g.balls[1]!;
    b.stuckOffset = null;
    b.x = 0x70 + 2;
    b.y = 440;
    b.dx = 0;
    b.dy = 3;
  }

  it("loses a life as soon as fewer than 2 balls are left, and both paddles explode", () => {
    const g = served();
    const lives = g.player.lives;
    drop(g);
    let n = 0;
    while (g.mode === GameMode.Playing && n++ < 100) g.tick(idle);
    expect(g.mode).toBe(GameMode.LifeLost);
    expect(g.player.lives).toBe(lives - 1);
    expect(g.paddleAnim2).not.toBeNull();
    expect(g.paddleAnim2!.x).toBe(g.paddle2!.x - 0x15);
  });

  it("keeps the life while two balls are still in play", () => {
    const g = served();
    const extra = createBall(1500);
    extra.x = 300;
    extra.y = 200;
    extra.dx = 1;
    extra.dy = -1;
    g.balls.push(extra);
    drop(g);
    ticks(g, 30);
    expect(g.mode).toBe(GameMode.Playing);
  });

  it("starts the next round with two balls again", () => {
    const g = served();
    drop(g);
    let n = 0;
    while (g.mode !== GameMode.Ready && n++ < 1000) g.tick(idle);
    expect(g.balls).toHaveLength(2);
    expect(g.paddle2!.x).toBe(PLAYER2_START_X);
  });
});

describe("bonuses (0x4055DC)", () => {
  it("lets player 2 catch a capsule, for the shared score", () => {
    const g = served();
    const score = g.player.score;
    caughtBy(g, 1, "large_ship");
    expect(g.bonus.picker).toBe(1);
    expect(keys(g.bonus.seats)).toEqual([null, "large_ship"]);
    expect(g.player.score).toBe(score + 30);
  });

  it("grows only the paddle of the catcher (0x4035AC)", () => {
    const g = served();
    caughtBy(g, 1, "large_ship");
    expect(g.paddle2!.w).toBe(105);
    expect(g.paddle.w).toBe(74);
  });

  it("leaves one player's lasting bonus when the other catches one", () => {
    const g = served();
    caughtBy(g, 0, "large_ship");
    caughtBy(g, 1, "mini_shoot");
    expect(g.paddle.w).toBe(105);
    expect(g.shotSystem2!.miniLeft.on).toBe(true);
    expect(g.shotSystem.miniLeft.on).toBe(false);
  });

  it("clears both slots with an instant bonus", () => {
    const g = served();
    caughtBy(g, 0, "large_ship");
    caughtBy(g, 1, "bonus");
    expect(keys(g.bonus.seats)).toEqual([null, null]);
    g.tick(idle);
    expect(g.paddle.w).toBe(74);
  });

  it("reverses player 2's keys only (0x406BBE)", () => {
    const g = served();
    caughtBy(g, 1, "reverse");
    const x1 = g.paddle.x;
    const x2 = g.paddle2!.x;
    g.tick({ paddleDx: 5, fire: false, paddle2Dx: 5 });
    expect(g.paddle.x).toBe(x1 + 5);
    expect(g.paddle2!.x).toBe(x2 - 5);
  });

  it("gives 10 ghost balls to the catcher, their first ball aside (0x406464, 0x403EE5)", () => {
    const g = served();
    caughtBy(g, 1, "ghost");
    expect(g.balls).toHaveLength(12);
    const p2 = g.balls.filter((b) => b.owner === 1);
    expect(p2).toHaveLength(11);
    expect(p2.filter((b) => b.ghost)).toHaveLength(10);
    expect(g.balls[0]!.ghost).toBe(false);
  });

  it("magnetises the catcher's paddle only (0x4063E6)", () => {
    const g = served();
    g.magnet.on = false;
    g.magnet2.on = false;
    caughtBy(g, 1, "magnetic");
    expect(g.magnet2.on).toBe(true);
    expect(g.magnet.on).toBe(false);
  });

  it("keeps the paddles from crossing under collision (0x406501, 0x402F9D)", () => {
    const g = served();
    caughtBy(g, 1, "collision");
    // Player 2 is on the left: player 1 stops on its right edge, it stops on player 1's left.
    g.tick({ paddleDx: -1000, fire: false });
    expect(g.paddle.x).toBe(g.paddle2!.x + 74);
    g.paddle.x = 400;
    ticks(g, 2);
    g.tick({ paddleDx: 0, fire: false, paddle2Dx: 1000 });
    expect(g.paddle2!.x).toBe(400 - 74);
  });
});

describe("player 2 played by the computer (0x404F8B)", () => {
  it("centres its paddle on the ball of slot 1, in play only", () => {
    const g = coop("computer");
    ticks(g, 5);
    expect(g.paddle2!.x).toBe(PLAYER2_START_X);
    g.tick(fire);
    const x = g.balls[1]!.x;
    g.tick(idle);
    expect(g.paddle2!.x).toBe(x - 37);
  });

  it("fires every 11 ticks without the latch (0x402CCC)", () => {
    const g = served("computer");
    g.bonus.active = g.bonus.seats[1] = bonusByKey("mini_shoot");
    let shots = 0;
    for (let i = 0; i < 23; i++) {
      g.tick(idle);
      if (g.sounds.includes("shoot")) shots++;
    }
    expect(shots).toBe(3);
  });
});

describe("end of a level (0x404C14)", () => {
  it("takes both paddles away", () => {
    const set = [level([]), ...Array.from({ length: 39 }, () => level())];
    const g = new Game(config(), set, Difficulty.Medium, new Rng(1), 0, "keyboard");
    let n = 0;
    while (g.mode !== GameMode.LevelEnd && n++ < 200) g.tick(idle);
    expect(g.mode).toBe(GameMode.LevelEnd);
    expect(g.paddleAnim2!.x).toBe(PLAYER2_START_X - 9);
  });
});
