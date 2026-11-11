import { describe, expect, it } from "vitest";
import { Rng } from "../core/rng";
import { BONUS_KEYS, Difficulty, type GameConfig, STATUS_KEYS, type Triplet } from "../data/config";
import { LEVEL_COLS, LEVEL_ROWS, type Level } from "../data/levels";
import { BallState } from "./ball";
import { BONUS_TICKS, bonusByKey } from "./bonus";
import {
  DEMO_SERVE,
  DEMO_SHOT_DELAY,
  DEMO_TICKS,
  MENU_IDLE_TICKS,
  MenuIdle,
  createDemo,
  demoPaddleX,
  demoShot,
  stepDemo,
} from "./demo";
import { Game, GameMode } from "./game";
import { PADDLE_X_MIN, createPaddle, paddleMaxX } from "./paddle";

const t = (v: number): Triplet => [v, v, v];

function config(over: Partial<GameConfig> = {}): GameConfig {
  return {
    editorFlag: 0,
    extraLife: 10000,
    mouseSpeed: 0,
    nbsLife: 3,
    startLevel: 1,
    freqChangeSpeed: 1500,
    bonusFreq: Object.fromEntries(BONUS_KEYS.map((k) => [k, t(0)])) as GameConfig["bonusFreq"],
    timeBetweenOption: [6, 10, 12],
    freqCreateMonster: [60000, 60000, 60000],
    // Not the demo speed, so that both serves can be told apart.
    startSpeed: [5, 5, 5],
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

/** Level with `bytes` on row 10 from column 0, numbered by a solid brick on row 0. */
function level(n: number, bytes: number[] = [0x21]): Level {
  return Array.from({ length: LEVEL_ROWS }, (_, r) =>
    Array.from({ length: LEVEL_COLS }, (_, c) =>
      r === 10 ? (bytes[c] ?? 0) : r === 0 && c === n ? 0x08 : 0,
    ),
  );
}

const levels = (count: number) => Array.from({ length: count }, (_, i) => level(i));

function demo(count = 6, seed = 1, over: Partial<GameConfig> = {}): Game {
  return new Game(config(over), levels(count), Difficulty.Medium, new Rng(seed), 0, true);
}

const idle = { paddleDx: 0, fire: false };

function until(g: Game, done: () => boolean, max = 2000): number {
  let n = 0;
  while (!done() && n < max) {
    g.tick(idle);
    n++;
  }
  return n;
}

describe("demo rules", () => {
  it("centres the paddle on ball 1, within the play area (0x404F64)", () => {
    const p = createPaddle();
    const ball = { x: 300 } as Parameters<typeof demoPaddleX>[1];
    expect(demoPaddleX(p, ball)).toBe(300 - (p.w >> 1));
    ball.x = 0;
    expect(demoPaddleX(p, ball)).toBe(PADDLE_X_MIN);
    ball.x = 640;
    expect(demoPaddleX(p, ball)).toBe(paddleMaxX(p));
  });

  it("fires once the counter is above 10, then counts from 0 (0x40290F)", () => {
    const d = createDemo();
    d.shotClock = DEMO_SHOT_DELAY;
    expect(demoShot(d)).toBe(false);
    d.shotClock++;
    expect(demoShot(d)).toBe(true);
    expect(d.shotClock).toBe(0);
  });

  it("lasts 800 turns of the main loop (0x40111A, 0x401F63)", () => {
    const d = createDemo();
    for (let i = 1; i < DEMO_TICKS; i++) expect(stepDemo(d)).toBe(false);
    expect(stepDemo(d)).toBe(true);
  });

  it("starts after 600 still ticks, a press counting as a move (0x4013D0, 0x401464)", () => {
    const idleMenu = new MenuIdle();
    for (let i = 1; i < MENU_IDLE_TICKS; i++) expect(idleMenu.tick(5, 5, i === 300)).toBe(false);
    for (let i = 0; i < 299; i++) expect(idleMenu.tick(5, 5, false)).toBe(false);
    expect(idleMenu.tick(5, 5, false)).toBe(true);
  });
});

describe("demo game", () => {
  it("draws any level of the set and says so (0x401D7C, 0x401D8D)", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const g = demo(6, seed);
      expect(g.level).toBeGreaterThanOrEqual(1);
      expect(g.level).toBeLessThanOrEqual(6);
      expect(g.message).toBe("demo");
      seen.add(g.level);
    }
    expect(seen.size).toBe(6);
  });

  it("lets the ball go at once at 3, -4, without the serve or its text (0x403820)", () => {
    const g = demo();
    until(g, () => g.mode === GameMode.Playing);
    expect(g.message).toBe("demo");
    const b = g.balls[0]!;
    expect([b.dx, b.dy]).toEqual([DEMO_SERVE.dx, DEMO_SERVE.dy]);
    expect(b.stuckOffset).not.toBeNull();
    g.tick(idle);
    expect(b.stuckOffset).toBeNull();
    expect(g.magnet.on).toBe(false);
  });

  it("keeps the paddle under ball 1 (0x404F64)", () => {
    const g = demo();
    until(g, () => g.mode === GameMode.Playing);
    for (let i = 0; i < 100; i++) {
      // The paddle moves before the ball (0x406D17, then 0x403913).
      const x = demoPaddleX(g.paddle, g.balls[0]!);
      g.tick({ paddleDx: 40, fire: false });
      expect(g.paddle.x).toBe(x);
    }
  });

  it("serves by itself after a lost life, at the speed of the level (0x40511C)", () => {
    const g = demo();
    until(g, () => g.mode === GameMode.Playing);
    g.tick(idle);
    const lives = g.player.lives;
    // The paddle under ball 1 sends it back even from below: it has to go by itself.
    g.balls[0]!.state = BallState.Dead;
    until(g, () => g.mode === GameMode.LifeLost);
    expect(g.player.lives).toBe(lives - 1);
    until(g, () => g.mode === GameMode.Ready);
    expect(g.message).toBe("ready");
    g.tick(idle);
    expect(g.mode).toBe(GameMode.Playing);
    expect(g.message).toBe("off");
    expect(g.balls[0]!.dx).not.toBe(DEMO_SERVE.dx);
  });

  it("releases a ball held by the magnet at once (0x403E27)", () => {
    const g = demo();
    until(g, () => g.mode === GameMode.Playing);
    g.tick(idle);
    const b = g.balls[0]!;
    g.magnet.on = true;
    b.stuckOffset = 10;
    g.tick(idle);
    expect(b.stuckOffset).toBeNull();
  });

  it("fires the cannons every 11 ticks, without fire (0x40290F)", () => {
    const g = demo();
    until(g, () => g.mode === GameMode.Playing);
    g.bonus.active = g.bonus.seats[0] = bonusByKey("mini_shoot");
    g.bonus.timer = BONUS_TICKS;
    const fired: number[] = [];
    for (let i = 0; i < 40; i++) {
      g.tick(idle);
      if (g.sounds.includes("shoot")) fired.push(i);
    }
    expect(fired.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < fired.length; i++) expect(fired[i]! - fired[i - 1]!).toBe(11);
  });

  it("ends after 800 turns of play, the waits not counting (0x401F63)", () => {
    const g = demo();
    until(g, () => g.mode === GameMode.Playing || g.mode === GameMode.Ready);
    let n = 0;
    while (!g.demoOver && n < 5000) {
      if (g.mode === GameMode.Ready || g.mode === GameMode.Playing) n++;
      g.tick(idle);
    }
    expect(g.demoOver).toBe(true);
    expect(n).toBe(DEMO_TICKS);
  });

  it("starts over at level 1 past the last level (0x401C88)", () => {
    const g = demo(3);
    // Read by the level load at the end of the fade in.
    g.level = 3;
    until(g, () => g.mode === GameMode.Playing);
    g.bonus.active = bonusByKey("next_level");
    until(g, () => g.mode === GameMode.LevelEnd);
    expect(g.finished).toBe(false);
    until(g, () => g.mode === GameMode.Arrival);
    expect(g.level).toBe(1);
  });

  it("turns into a game once over, with the scores first (0x401FCE)", () => {
    const g = demo(6, 1, { nbsLife: 1 });
    until(g, () => g.mode === GameMode.Playing);
    g.tick(idle);
    // The paddle under ball 1 sends it back even from below: it has to go by itself.
    g.balls[0]!.state = BallState.Dead;
    until(g, () => g.mode === GameMode.GameOverWait);
    expect(g.scoresDue).toBe(true);
    g.tick({ paddleDx: 0, fire: true });
    expect(g.mode).toBe(GameMode.GameOverWait);
    g.tick(idle);
    expect(g.demo).toBeNull();
    expect(g.level).toBe(1);
    until(g, () => g.mode === GameMode.Ready);
    expect(g.message).toBe("ready");
    g.tick(idle);
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.balls[0]!.state).toBe(BallState.Active);
  });
});
