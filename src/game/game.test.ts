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
import { BALL_SPRITE, BallState } from "./ball";
import { BONUS_TICKS, CapsuleState, bonusByKey, spawnCapsule } from "./bonus";
import { FADE_STEPS } from "../render/fade";
import { Game, GameMode, NIGHT_FADE, serveSpeed, speedInterval } from "./game";
import { spawnMonster, monsterSprite } from "./monsters";
import { updateCannons } from "./shots";

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
/** Paddle arrival before the serve (0x404B88), as long as the warp. */
const ARRIVAL_TICKS = 18;
const READY_TICKS = FADE_IN_TICKS + ARRIVAL_TICKS;

/** Pads the set to 40 levels: the serve speed divides by levelCount / 3. */
function newGame(levels: Level[] = [level()], over: Partial<GameConfig> = {}, count = 40) {
  const set = [...levels];
  while (set.length < count) set.push(level());
  return new Game(config(over), set, Difficulty.Medium, new Rng(1));
}

/** A new game past its fade in and paddle arrival, waiting for the serve. */
function game(levels?: Level[], over?: Partial<GameConfig>, count?: number) {
  const g = newGame(levels, over, count);
  for (let i = 0; i < READY_TICKS; i++) g.tick({ paddleDx: 0, fire: false });
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
    expect(serveSpeed(3, 3, 1, 40)).toEqual({ dx: 3, dy: -4 });
    expect(serveSpeed(3, 3, 12, 40)).toEqual({ dx: 3, dy: -4 });
    expect(serveSpeed(3, 3, 13, 40)).toEqual({ dx: 4, dy: -5 });
    expect(serveSpeed(3, 3, 26, 40)).toEqual({ dx: 5, dy: -6 });
    expect(serveSpeed(3, 3, 39, 40)).toEqual({ dx: 6, dy: -7 });
    expect(serveSpeed(2, 2, 20, 40)).toEqual({ dx: 3, dy: -4 });
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
    expect(g.mode).toBe(GameMode.Arrival);
    expect(g.bare).toBe(false);
    expect(g.grid.cells[130]).toBe(1);
    expect(g.paddle.x).toBe(283);
  });

  it("ends the game after the last level without the warp", () => {
    const g = game([level([])], {}, 1);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.Finished);
    expect(g.paddleAnim).toBeNull();
  });

  it("signals the end screens and does nothing more (0x401C82)", () => {
    const g = game([level([])], {}, 1);
    expect(g.finished).toBe(false);
    g.tick(idle);
    expect(g.finished).toBe(true);
    g.tick(fire);
    expect(g.mode).toBe(GameMode.Finished);
    expect(g.sounds).toEqual([]);
  });
});

describe("pause (0x4020A8)", () => {
  const ready = () => {
    const g = game([level([0x24, 0x21]), level()]);
    for (let i = 0; i < 100 && g.mode !== GameMode.Ready; i++) g.tick(idle);
    return g;
  };

  it("only works in the main loop", () => {
    const g = ready();
    expect(g.canPause).toBe(true);
    expect(g.canLeave).toBe(true);
    g.mode = GameMode.FadeIn;
    expect(g.canPause).toBe(false);
    expect(g.canLeave).toBe(false);
    g.mode = GameMode.GameOverWait;
    expect(g.canPause).toBe(false);
    expect(g.canLeave).toBe(false);
  });

  it("moves the objects once, then stands still", () => {
    const g = ready();
    g.tick(fire);
    expect(g.mode).toBe(GameMode.Playing);
    g.startPause();
    expect(g.message).toBe("paused");
    const before = { x: g.balls[0]!.x, y: g.balls[0]!.y };
    g.tick(idle);
    const after = { x: g.balls[0]!.x, y: g.balls[0]!.y };
    expect(after).not.toEqual(before);
    for (let i = 0; i < 10; i++) g.tick(idle);
    expect({ x: g.balls[0]!.x, y: g.balls[0]!.y }).toEqual(after);
  });

  it("does not move the paddle", () => {
    const g = ready();
    const x = g.paddle.x;
    g.startPause();
    g.tick({ paddleDx: 20, fire: false });
    g.tick({ paddleDx: 20, fire: false });
    expect(g.paddle.x).toBe(x);
  });

  it("blanks the status line on resume, even a ready message", () => {
    const g = ready();
    expect(g.message).toBe("ready");
    g.startPause();
    g.tick(idle);
    g.endPause();
    expect(g.paused).toBe(false);
    expect(g.message).toBe("off");
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
    expect(g.mode).toBe(GameMode.Arrival);
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
    expect(g.scoresDue).toBe(true);
    expect(g.screenFade).toBe(FADE_STEPS - 1);
    g.tick(fire);
    expect(g.mode).toBe(GameMode.GameOverWait);
    g.tick(idle);
    expect(g.sounds).toContain("restart");
    // 0x401FB4 goes back to 0x401D4C: no fade out, background load and fade in.
    expect(g.mode).toBe(GameMode.FadeIn);
    expect(g.bare).toBe(true);
    expect(g.player).toEqual({ score: 0, lives: 0, nextLife: 10000 });
    ticks(g, READY_TICKS);
    expect(g.mode).toBe(GameMode.Ready);
  });
});

describe("paddle arrival (0x404B88)", () => {
  it("runs at every round, ball hidden, then the ball waits on the paddle", () => {
    const g = newGame();
    ticks(g, FADE_IN_TICKS);
    expect(g.mode).toBe(GameMode.Arrival);
    expect(g.balls[0]!.state).toBe(BallState.Dead);
    expect(g.paddleAnim).toMatchObject({ x: 283 - 9, y: 0x197, visible: true });
    expect(g.paddleAnim!.anim.first).toBe(0x89242);
    ticks(g, ARRIVAL_TICKS - 1);
    expect(g.mode).toBe(GameMode.Arrival);
    expect(g.paddleAnim?.visible).toBe(true);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.paddleAnim).toBeNull();
    expect(g.balls[0]!.state).toBe(BallState.Active);
  });

  it("ignores the fire button and the paddle input", () => {
    const g = newGame();
    ticks(g, FADE_IN_TICKS);
    ticks(g, ARRIVAL_TICKS, { paddleDx: 10, fire: true });
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.paddle.x).toBe(283);
  });

  it("also runs after a lost life", () => {
    const g = game([level([0x24, 0x21]), level()]);
    g.tick(fire);
    dropBall(g);
    until(g, GameMode.LifeLost);
    expect(until(g, GameMode.Arrival)).toBe(110);
    expect(until(g, GameMode.Ready)).toBe(ARRIVAL_TICKS);
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
    expect(g.mode).toBe(GameMode.Arrival);
    expect(g.message).toBe("ready");
  });
});

/** Serving game with a capsule of `key` about to be caught, ball parked out of harm's way. */
function catching(key: Parameters<typeof bonusByKey>[0], levels?: Level[]): Game {
  const g = game(levels ?? [level([0x24, 0x24]), level()]);
  g.tick(fire);
  park(g);
  spawnCapsule(g.capsules, bonusByKey(key), g.paddle.x, 414);
  return g;
}

/** Keeps the ball in play with no brick in reach: stuck to the paddle. */
function park(g: Game): void {
  g.balls[0]!.stuckOffset = 10;
  g.magnet.on = true;
}

describe("bonus drop (0x40531A)", () => {
  function hitFirstBrick(g: Game): void {
    const b = g.balls[0]!;
    b.stuckOffset = null;
    b.x = 0x70 + 10;
    b.y = 177;
    b.dx = 0;
    b.dy = -3;
    g.tick(idle);
  }
  const all = (v: number) =>
    Object.fromEntries(BONUS_KEYS.map((k) => [k, t(v)])) as GameConfig["bonusFreq"];

  it("drops a capsule at the corner of the destroyed brick, already moved", () => {
    const g = game([level([0x21, 0x21]), level()], { bonusFreq: all(1) });
    g.tick(fire);
    hitFirstBrick(g);
    expect(g.capsules[0]).toMatchObject({ x: 112, y: 162, state: CapsuleState.Falling });
  });

  it("counts Time_Between_Option in ticks, across all modes", () => {
    const g = newGame([level([0x21, 0x21]), level()], {
      bonusFreq: all(1),
      timeBetweenOption: t(READY_TICKS + 3),
    });
    ticks(g, READY_TICKS);
    g.tick(fire);
    hitFirstBrick(g);
    expect(g.capsules[0]!.state).toBe(CapsuleState.Free);
  });

  it("drops nothing on a damaged brick", () => {
    const g = game([level([0x24, 0x21]), level()], { bonusFreq: all(1) });
    g.tick(fire);
    hitFirstBrick(g);
    expect(g.capsules[0]!.state).toBe(CapsuleState.Free);
  });
});

describe("catching a capsule (0x4055AE)", () => {
  it("activates the bonus on the catch tick: sound, 2 units, icon, flash", () => {
    const g = catching("reverse");
    const score = g.player.score;
    g.tick(idle);
    expect(g.sounds).toContain("optionon");
    expect(g.player.score).toBe(score + 30);
    expect(g.bonus.active?.key).toBe("reverse");
    expect(g.bonus.timer).toBe(BONUS_TICKS);
    expect(g.bonus.icon).toBe(0x7596d);
    expect(g.flash.on).toBe(true);
    // The label comes with the next run of 0x405DD2.
    expect(g.message).toBe("off");
    g.tick(idle);
    expect(g.message).toBe("reverse");
    expect(g.bonus.active?.key).toBe("reverse");
  });

  it("is not possible before the serve", () => {
    const g = game();
    spawnCapsule(g.capsules, bonusByKey("bonus"), g.paddle.x, 414);
    g.tick(idle);
    expect(g.bonus.active).toBeNull();
  });

  it("writes the same label only once", () => {
    const g = catching("reverse");
    ticks(g, 2);
    g.message = "other";
    spawnCapsule(g.capsules, bonusByKey("reverse"), g.paddle.x, 414);
    ticks(g, 2);
    expect(g.message).toBe("other");
  });
});

describe("instant bonuses (0x405DD2)", () => {
  it("adds 1, 3, 6 and 20 balls the tick after the catch", () => {
    for (const [key, n] of [
      ["3_ball", 2],
      ["6_ball", 4],
      ["9_ball", 7],
      ["20_ball", 20],
    ] as const) {
      const g = catching(key);
      g.tick(idle);
      expect(g.balls).toHaveLength(1);
      g.tick(idle);
      expect(g.balls.filter((b) => b.state === BallState.Active)).toHaveLength(n);
      expect(g.bonus.active).toBeNull();
      expect(g.bonus.icon).not.toBeNull();
      expect(g.message).toBe(key);
    }
  });

  it("death takes a spare life, without a game over", () => {
    const g = catching("death");
    ticks(g, 2);
    expect(g.sounds).toContain("death");
    expect(g.player.lives).toBe(1);
    expect(g.livesShown).toBe(1);
    expect(g.bonus.active).toBeNull();
    g.player.lives = 0;
    spawnCapsule(g.capsules, bonusByKey("death"), g.paddle.x, 414);
    ticks(g, 2);
    expect(g.player.lives).toBe(0);
    expect(g.mode).toBe(GameMode.Playing);
  });

  it("new_life gives a life", () => {
    const g = catching("new_life");
    ticks(g, 2);
    expect(g.sounds).toContain("newlife");
    expect(g.player.lives).toBe(3);
    expect(g.livesShown).toBe(3);
    expect(g.bonus.active).toBeNull();
  });

  it("+100 is 8 units with the difficulty bonus, on top of the catch", () => {
    const g = catching("bonus");
    const score = g.player.score;
    ticks(g, 2);
    expect(g.player.score).toBe(score + 30 + 90);
    expect(g.bonus.active).toBeNull();
  });

  it("−100 removes 12 units, without the difficulty bonus", () => {
    const g = catching("malus");
    g.player.score = 500;
    ticks(g, 2);
    expect(g.player.score).toBe(500 + 30 - 120);
    expect(g.bonus.active).toBeNull();
  });

  it("add_monster spawns a monster, restarts the timer and clears the slot (0x40643B)", () => {
    const g = catching("add_monster");
    g.tick(idle);
    g.monsterSystem.timer = 100;
    g.tick(idle);
    expect(g.bonus.active).toBeNull();
    expect(g.monsterSystem.monsters).toHaveLength(1);
    // The timer tick runs after the bonus routine (0x405DD2, then 0x403A93).
    expect(g.monsterSystem.timer).toBe(1);
  });

  it("del_monster blows up all monsters without score, one sound each (0x4063C2)", () => {
    const g = catching("del_monster");
    spawnMonster(g.monsterSystem, 1, new Rng(1));
    spawnMonster(g.monsterSystem, 1, new Rng(2));
    g.tick(idle);
    const score = g.player.score;
    g.tick(idle);
    expect(g.bonus.active).toBeNull();
    expect(g.monsterSystem.monsters.map((m) => m.state)).toEqual([BallState.Lost, BallState.Lost]);
    expect(g.sounds.filter((s) => s === "monstoff")).toHaveLength(2);
    expect(g.player.score).toBe(score);
  });
});

describe("next_level (0x4045BB)", () => {
  it("ends the level on the catch tick", () => {
    const g = catching("next_level");
    g.tick(idle);
    expect(g.mode).toBe(GameMode.LevelEnd);
    expect(g.sounds).toContain("next");
    expect(g.bonus.active).toBeNull();
  });
});

describe("bonus timer (0x405E1A)", () => {
  it("blanks the message after 100 ticks and drops the icon of an instant bonus", () => {
    const g = catching("bonus");
    g.tick(idle);
    ticks(g, 99);
    expect(g.message).toBe("bonus");
    expect(g.bonus.icon).not.toBeNull();
    g.tick(idle);
    expect(g.message).toBe("off");
    expect(g.bonus.icon).toBeNull();
    expect(g.bonus.label).toBeNull();
  });

  it("keeps the label and icon of a lasting bonus, until it ends", () => {
    const g = catching("reverse");
    g.tick(idle);
    ticks(g, 101);
    expect(g.message).toBe("off");
    expect(g.bonus.icon).toBe(0x7596d);
    g.bonus.timer = 1;
    g.balls[0]!.stuckOffset = 5;
    g.tick(idle);
    expect(g.sounds).toContain("endopt");
    expect(g.bonus.active).toBeNull();
    expect(g.bonus.icon).toBeNull();
    expect(g.balls[0]!.stuckOffset).toBeNull();
  });

  it("plays endopt even after an instant bonus", () => {
    const g = catching("bonus");
    ticks(g, 2);
    g.bonus.timer = 1;
    g.tick(idle);
    expect(g.sounds).toContain("endopt");
  });

  it("does not run before the serve", () => {
    const g = game();
    g.bonus.timer = 50;
    g.tick(idle);
    expect(g.bonus.timer).toBe(50);
  });
});

describe("bonus cleared", () => {
  it("by an extra life, with the timer left running (0x405FB1)", () => {
    const g = catching("reverse");
    g.tick(idle);
    g.player.score = 10000;
    g.tick(idle);
    expect(g.bonus.active).toBeNull();
    expect(g.bonus.timer).toBe(BONUS_TICKS - 1);
    expect(g.bonus.label).toBe("new_life");
  });

  it("by a lost life, along with its timer (0x404AED)", () => {
    const g = catching("reverse");
    g.tick(idle);
    dropBall(g);
    until(g, GameMode.LifeLost);
    expect(g.bonus.active).toBeNull();
    expect(g.bonus.timer).toBe(0);
  });

  it("by a new round, with the capsules and the icon (0x401DB5)", () => {
    const g = catching("reverse");
    g.tick(idle);
    spawnCapsule(g.capsules, bonusByKey("bonus"), 112, 0);
    dropBall(g);
    until(g, GameMode.LifeLost);
    until(g, GameMode.Arrival);
    expect(g.capsules.every((c) => c.state === CapsuleState.Free)).toBe(true);
    expect(g.bonus.icon).toBeNull();
    expect(g.flash.shown).toBe(0);
  });
});

describe("wait loops (0x402058)", () => {
  it("keep capsules falling without catching them, and the flash running", () => {
    const g = catching("reverse");
    g.tick(idle);
    const shown = g.flash.shown;
    spawnCapsule(g.capsules, bonusByKey("bonus"), g.paddle.x, 100);
    dropBall(g);
    until(g, GameMode.LifeLost);
    const c = g.capsules.find((k) => k.state === CapsuleState.Falling)!;
    const { y } = c;
    c.y = 414;
    g.tick(idle);
    expect(c.y).toBe(416);
    expect(c.state).toBe(CapsuleState.Falling);
    expect(g.bonus.active).toBeNull();
    expect(y).toBeGreaterThan(100);
    expect(g.flash.shown).toBeGreaterThan(shown);
  });
});

/** `catching` then the catch tick: the bonus runs from the next tick on. */
function caught(key: Parameters<typeof bonusByKey>[0], levels?: Level[]): Game {
  const g = catching(key, levels);
  g.tick(idle);
  return g;
}

describe("capsules while the paddle leaves (0x4054D2, 0x4031D1)", () => {
  /** A cleared level: the normal warp object is 92 wide, 9 px left of the paddle. */
  function leaving() {
    const g = game([level([]), level()]);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.LevelEnd);
    return g;
  }

  it("catches in mode 3, with the rectangle of the warp object", () => {
    const g = leaving();
    const score = g.player.score;
    spawnCapsule(g.capsules, bonusByKey("reverse"), g.paddle.x - 9, 414);
    g.tick(idle);
    expect(g.bonus.active?.key).toBe("reverse");
    expect(g.bonus.icon).not.toBeNull();
    expect(g.sounds).toContain("optionon");
    expect(g.player.score).toBe(score + 30);
  });

  it("misses a capsule that does not fit in that rectangle", () => {
    for (const x of [283 - 10, 283 - 9 + 92 - 25]) {
      const g = leaving();
      spawnCapsule(g.capsules, bonusByKey("reverse"), x, 414);
      g.tick(idle);
      expect(g.bonus.active).toBeNull();
    }
  });

  it("still catches once the paddle is hidden", () => {
    const g = leaving();
    while (g.paddleAnim!.visible) g.tick(idle);
    spawnCapsule(g.capsules, bonusByKey("reverse"), g.paddle.x, 414);
    g.tick(idle);
    expect(g.bonus.active?.key).toBe("reverse");
  });

  it("does not run the caught bonus, and the next round clears it", () => {
    const g = leaving();
    spawnCapsule(g.capsules, bonusByKey("large_ship"), g.paddle.x, 414);
    g.tick(idle);
    until(g, GameMode.Ready);
    expect(g.paddle.w).toBe(74);
    expect(g.bonus.active).toBeNull();
    expect(g.bonus.icon).toBeNull();
    expect(g.level).toBe(2);
  });

  it("does not catch during a paddle explosion, outside mode 3", () => {
    const g = game();
    g.tick(fire);
    dropBall(g);
    until(g, GameMode.LifeLost);
    spawnCapsule(g.capsules, bonusByKey("reverse"), g.paddle.x, 414);
    g.tick(idle);
    expect(g.bonus.active).toBeNull();
  });
});

describe("one-tick bonuses (0x4039E9)", () => {
  it("act once, the icon and the label staying until the message ends", () => {
    for (const key of ["fast_ball", "slow_ball", "iron_ball", "telepod"] as const) {
      const g = caught(key);
      g.tick(idle);
      expect(g.bonus.active).toBeNull();
      expect(g.message).toBe(key);
      expect(g.bonus.icon).not.toBeNull();
      ticks(g, 100);
      expect(g.message).toBe("off");
      expect(g.bonus.icon).toBeNull();
    }
  });

  it("fast speeds up all the balls once, silently", () => {
    const g = caught("fast_ball");
    const b = g.balls[0]!;
    const [dx, dy] = [b.dx, b.dy];
    g.tick(idle);
    expect([b.dx, b.dy]).toEqual([dx + 1, dy - 1]);
    expect(g.sounds).not.toContain("speedup");
    g.tick(idle);
    expect([b.dx, b.dy]).toEqual([dx + 1, dy - 1]);
  });

  it("slow slows down all the balls once", () => {
    const g = caught("slow_ball");
    const b = g.balls[0]!;
    const [dx, dy] = [b.dx, b.dy];
    g.tick(idle);
    expect([b.dx, b.dy]).toEqual([dx - 1, dy + 1]);
    g.tick(idle);
    expect([b.dx, b.dy]).toEqual([dx - 1, dy + 1]);
  });

  it("telepod moves the balls silently into the landing zone", () => {
    const g = caught("telepod");
    const b = g.balls[0]!;
    b.stuckOffset = null;
    g.magnet.on = false;
    b.x = 300;
    b.y = 300;
    b.dx = 0;
    b.dy = -1;
    g.tick(idle);
    expect(b.x).toBeGreaterThanOrEqual(212);
    expect(b.y).toBeGreaterThanOrEqual(100);
    expect(g.sounds).not.toContain("telepod");
  });

  it("iron stays on the balls in play and not on the ones created later", () => {
    const g = caught("iron_ball");
    g.tick(idle);
    const b = g.balls[0]!;
    expect(b.bouncesOnBricks).toBe(false);
    expect(b.anim.frame).toBe(0);
    spawnCapsule(g.capsules, bonusByKey("3_ball"), g.paddle.x, 414);
    ticks(g, 2);
    expect(g.balls[1]!.bouncesOnBricks).toBe(true);
    expect(g.balls[1]!.anim.frame).toBe(BALL_SPRITE);
    expect(g.balls[0]!.bouncesOnBricks).toBe(false);
  });
});

describe("reverse (0x406E12)", () => {
  it("negates the paddle movement while active", () => {
    const g = caught("reverse");
    const { x } = g.paddle;
    expect(g.reversed).toBe(true);
    g.tick({ paddleDx: 10, fire: false });
    expect(g.paddle.x).toBe(x - 10);
    g.bonus.timer = 1;
    // The timer runs before the input: this move is already a normal one.
    g.tick({ paddleDx: 10, fire: false });
    expect(g.reversed).toBe(false);
    expect(g.paddle.x).toBe(x);
  });
});

describe("large and small paddles (0x4033A9, 0x4034B0)", () => {
  it("large widens the paddle with its sound", () => {
    const g = caught("large_ship");
    expect(g.paddle.w).toBe(74);
    g.tick(idle);
    expect(g.sounds).toContain("large");
    expect(g.paddle.w).toBe(105);
    expect(g.paddle.anim.first).toBe(0x6a28);
    g.tick(idle);
    expect(g.sounds).not.toContain("large");
  });

  it("small narrows it, unsticking the balls but keeping the magnet", () => {
    const g = caught("small_ship");
    g.tick(idle);
    expect(g.sounds).toContain("small");
    expect(g.paddle.w).toBe(38);
    expect(g.paddle.anim.first).toBe(0x6afa);
    expect(g.balls[0]!.stuckOffset).toBeNull();
    expect(g.magnet.on).toBe(true);
  });

  it("goes back to normal when the bonus ends, with the cannons off (0x4025B0)", () => {
    const g = caught("large_ship");
    g.tick(idle);
    g.bonus.timer = 1;
    g.tick(idle);
    expect(g.bonus.active).toBeNull();
    g.tick(idle);
    expect(g.paddle.w).toBe(74);
    expect(g.paddle.anim).toMatchObject({ first: 0x6900, frames: 4 });
  });

  it("unsticks the balls when leaving the large paddle, not the small one", () => {
    const g = caught("large_ship");
    g.tick(idle);
    g.bonus.active = bonusByKey("reverse");
    g.balls[0]!.stuckOffset = 12;
    g.tick(idle);
    expect(g.paddle.w).toBe(74);
    expect(g.balls[0]!.stuckOffset).toBeNull();
    expect(g.magnet.on).toBe(true);

    const s = caught("small_ship");
    s.tick(idle);
    s.bonus.active = bonusByKey("reverse");
    s.balls[0]!.stuckOffset = 12;
    s.tick(idle);
    expect(s.paddle.w).toBe(74);
    expect(s.balls[0]!.stuckOffset).toBe(12);
  });

  it("goes straight from large to small on the same tick", () => {
    const g = caught("large_ship");
    g.tick(idle);
    g.bonus.active = bonusByKey("small_ship");
    g.tick(idle);
    expect(g.paddle.w).toBe(38);
    expect(g.sounds).toContain("small");
  });

  it("is clamped by the input of the tick it grows", () => {
    const g = catching("large_ship");
    g.paddle.x = 454;
    g.capsules[0]!.x = 454;
    ticks(g, 2);
    expect(g.paddle.x).toBe(0x210 - 105);
  });

  it("uses the explosion of its size when a life is lost (0x4030DC)", () => {
    const g = caught("large_ship");
    g.tick(idle);
    dropBall(g);
    const { x } = g.paddle;
    until(g, GameMode.LifeLost);
    expect(g.paddleAnim!.anim).toMatchObject({ first: 0x1c7d5, w: 0x8f });
    expect(g.paddleAnim!.x).toBe(x - 0x13);
  });

  it("uses the warp of its size at the level end (0x4032B4)", () => {
    const g = caught("small_ship", [level([0x24, 0x24]), level()]);
    g.tick(idle);
    const { x } = g.paddle;
    g.grid.cells.fill(0);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.LevelEnd);
    expect(g.paddleAnim!.anim).toMatchObject({ first: 0x8929f, w: 0x5c });
    expect(g.paddleAnim!.x).toBe(x - 0x1b);
  });

  it("is normal again at the next round", () => {
    const g = caught("large_ship");
    g.tick(idle);
    dropBall(g);
    until(g, GameMode.LifeLost);
    until(g, GameMode.Ready);
    expect(g.paddle.w).toBe(74);
    expect(g.paddle.anim.first).toBe(0x6900);
  });
});

describe("paddle animation in the loop (0x4066BA)", () => {
  it("runs while waiting for the serve", () => {
    const g = game();
    const { anim } = g.paddle;
    ticks(g, 12);
    expect(anim.frame).toBe(0x6900 + 74);
  });
});

describe("magnet (0x4063E6)", () => {
  it("runs the tick after the catch: previous bonus back, label forgotten, flag on", () => {
    const g = caught("reverse");
    g.tick(idle);
    g.magnet.on = false;
    spawnCapsule(g.capsules, bonusByKey("magnetic"), g.paddle.x, 414);
    g.tick(idle);
    expect(g.bonus.active?.key).toBe("magnetic");
    g.tick(idle);
    expect(g.message).toBe("magnetic");
    expect(g.magnet.on).toBe(true);
    expect(g.bonus.active?.key).toBe("reverse");
    expect(g.bonus.label).toBeNull();
    g.tick(idle);
    expect(g.message).toBe("reverse");
  });

  it("sticks the next ball that touches the paddle", () => {
    const g = caught("magnetic");
    g.tick(idle);
    const b = g.balls[0]!;
    b.stuckOffset = null;
    b.x = g.paddle.x + 20;
    b.y = 0x1a0 - 9;
    b.dx = 2;
    b.dy = 3;
    g.tick(idle);
    expect(b.stuckOffset).toBe(20);
    expect(b.dy).toBe(-3);
    ticks(g, 3, { paddleDx: 5, fire: false });
    expect(b.x).toBe(g.paddle.x + 20);
    expect(b.y).toBe(0x1a0 - 9);
  });

  it("ends at the first release: all the stuck balls leave", () => {
    const g = caught("magnetic");
    g.tick(idle);
    spawnCapsule(g.capsules, bonusByKey("3_ball"), g.paddle.x, 414);
    ticks(g, 2);
    const [a, b] = g.balls as [(typeof g.balls)[0], (typeof g.balls)[0]];
    b.stuckOffset = 30;
    b.dx = 2;
    b.dy = -3;
    a.dx = 2;
    a.dy = -3;
    const [ay, by] = [g.paddle.y - 9, g.paddle.y - 9];
    g.tick(idle);
    expect(a.y).toBe(ay);
    expect(b.y).toBe(by);
    g.tick(fire);
    expect(g.magnet.on).toBe(false);
    expect(a.stuckOffset).toBeNull();
    expect(a.y).toBe(ay - 3);
    expect(b.y).toBe(by - 3);
  });

  it("is released by the end of the timer (0x405E58)", () => {
    const g = caught("magnetic");
    g.tick(idle);
    g.bonus.timer = 1;
    g.tick(idle);
    expect(g.magnet.on).toBe(false);
    expect(g.balls[0]!.stuckOffset).toBeNull();
  });

  it("is the same flag that holds the ball for the serve (0x40504F)", () => {
    const g = game();
    expect(g.magnet.on).toBe(true);
    g.tick(fire);
    expect(g.magnet.on).toBe(false);
  });
});

describe("points x2 (0x406310)", () => {
  it("turns on with its sound, darkens the screen and clears the slot", () => {
    const g = caught("night");
    g.tick(idle);
    expect(g.doubled).toBe(true);
    expect(g.sounds).toContain("night");
    expect(g.screenFade).toBe(NIGHT_FADE);
    expect(g.bonus.active).toBeNull();
    expect(g.bonus.icon).not.toBeNull();
  });

  it("doubles every score, after the difficulty bonus", () => {
    const g = caught("night");
    g.tick(idle);
    const start = g.player.score;
    spawnCapsule(g.capsules, bonusByKey("bonus"), g.paddle.x, 414);
    g.tick(idle);
    expect(g.player.score).toBe(start + 60);
    g.tick(idle);
    expect(g.player.score).toBe(start + 60 + 180);
    g.bonus.active = bonusByKey("malus");
    g.tick(idle);
    expect(g.player.score).toBe(start + 60 + 180 - 240);
  });

  it("doubles a brick (0x40841D)", () => {
    const g = caught("night", [level([0x21, 0x21]), level()]);
    g.tick(idle);
    const start = g.player.score;
    const b = g.balls[0]!;
    b.stuckOffset = null;
    b.x = 0x70 + 10;
    b.y = 177;
    b.dx = 0;
    b.dy = -3;
    g.tick(idle);
    expect(g.player.score).toBe(start + 40);
  });

  it("doubles the extra life award (0x40600B)", () => {
    const g = caught("night");
    g.tick(idle);
    g.player.score = 10000;
    g.tick(idle);
    expect(g.player.score).toBe(10000 + 180);
  });

  it("is cancelled by a lasting bonus, not by an instant one (0x406370)", () => {
    const g = caught("night");
    g.tick(idle);
    g.bonus.active = bonusByKey("bonus");
    g.tick(idle);
    expect(g.doubled).toBe(true);
    g.flash.on = false;
    g.flash.shown = 5;
    g.bonus.active = bonusByKey("reverse");
    g.tick(idle);
    expect(g.doubled).toBe(false);
    expect(g.screenFade).toBe(0);
    expect(g.flash.shown).toBe(0);
  });

  it("flickers off for one tick when caught again, then back on", () => {
    const g = caught("night");
    g.tick(idle);
    g.bonus.active = bonusByKey("night");
    g.tick(idle);
    expect(g.doubled).toBe(false);
    expect(g.bonus.active?.key).toBe("night");
    expect(g.sounds).not.toContain("night");
    g.tick(idle);
    expect(g.doubled).toBe(true);
    expect(g.bonus.active).toBeNull();
    expect(g.sounds).toContain("night");
  });

  it("ends with the timer, palette back (0x405E88)", () => {
    const g = caught("night");
    g.tick(idle);
    g.bonus.timer = 1;
    g.flash.on = false;
    g.flash.shown = 3;
    g.tick(idle);
    expect(g.doubled).toBe(false);
    expect(g.screenFade).toBe(0);
    expect(g.flash.shown).toBe(0);
  });

  it("ends with a new round (0x401DCE)", () => {
    const g = caught("night");
    g.tick(idle);
    dropBall(g);
    until(g, GameMode.LifeLost);
    expect(g.doubled).toBe(true);
    expect(g.screenFade).toBe(NIGHT_FADE);
    until(g, GameMode.Arrival);
    expect(g.doubled).toBe(false);
  });

  it("starts the fade out at step 16 and ends there (0x4065F9)", () => {
    const g = caught("night", [level([0x24, 0x24]), level()]);
    g.tick(idle);
    g.grid.cells.fill(0);
    until(g, GameMode.FadeOut);
    expect(g.doubled).toBe(false);
    g.tick(idle);
    expect(g.screenFade).toBe(NIGHT_FADE);
    g.tick(idle);
    expect(g.screenFade).toBe(NIGHT_FADE + 1);
    expect(until(g, GameMode.FadeIn)).toBe(FADE_STEPS - NIGHT_FADE - 2);
  });
});

describe("ghost bonus (0x40645F)", () => {
  it("adds 20 balls, all ghost but the first in play", () => {
    const g = caught("ghost");
    g.tick(idle);
    expect(g.balls).toHaveLength(20);
    expect(g.bonus.active).toBeNull();
    expect(g.balls[0]!.ghost).toBe(false);
    expect(g.balls.slice(1).every((b) => b.ghost)).toBe(true);
    expect(g.balls[1]!.anim.frame).toBe(0x1692);
  });

  it("counts a dying ghost as in play until it is gone (0x404A38)", () => {
    const g = caught("ghost");
    g.tick(idle);
    for (const b of g.balls.slice(2)) b.state = BallState.Dead;
    g.balls[0]!.state = BallState.Dead;
    const ghost = g.balls[1]!;
    ghost.x = g.paddle.x + 10;
    ghost.y = 0x1a0 - 9;
    ghost.dx = 0;
    ghost.dy = 3;
    g.tick(idle);
    expect(ghost.dying).toBe(7);
    expect(g.sounds).not.toContain("wall");
    ticks(g, 10);
    expect(g.mode).toBe(GameMode.Playing);
    g.tick(idle);
    expect(ghost.state).toBe(BallState.Dead);
    expect(g.mode).toBe(GameMode.LifeLost);
  });
});

describe("shots in the game (0x402828)", () => {
  it("shows the cannons once its routine has run", () => {
    const g = caught("mini_shoot");
    const { miniLeft, miniRight } = g.shotSystem;
    expect(miniLeft.on).toBe(false);
    g.tick(idle);
    expect([miniLeft.on, miniRight.on]).toEqual([true, true]);
    expect(miniLeft.x).toBe(g.paddle.x + 7);
    expect(miniLeft.anim.frame).toBeGreaterThanOrEqual(0x1caf6);
  });

  it("plays the shoot sound, one shot per press", () => {
    const g = caught("mini_shoot");
    g.magnet.on = false;
    g.balls[0]!.stuckOffset = null;
    g.balls[0]!.x = 300;
    g.balls[0]!.y = 300;
    g.tick(fire);
    expect(g.sounds).toContain("shoot");
    g.tick(fire);
    expect(g.sounds).not.toContain("shoot");
    expect(g.shotSystem.shots).toHaveLength(1);
    expect(g.bonus.active?.key).toBe("mini_shoot");
  });

  it("big is a single shot: slot, icon and label go, the cannon next tick", () => {
    const g = caught("shoot");
    g.magnet.on = false;
    g.balls[0]!.stuckOffset = null;
    g.balls[0]!.x = 300;
    g.balls[0]!.y = 300;
    g.tick(fire);
    expect(g.sounds).toContain("shoot");
    expect(g.bonus.active).toBeNull();
    expect(g.bonus.icon).toBeNull();
    expect(g.bonus.label).toBeNull();
    expect(g.shotSystem.big.on).toBe(true);
    g.tick(idle);
    expect(g.shotSystem.big.on).toBe(false);
  });

  /** Game with a mini shot right under the first cell of row 10. */
  function shotUnderBrick(bytes: number[]) {
    const g = caught("mini_shoot", [level(bytes), level()]);
    g.tick(idle);
    g.tick(fire);
    const shot = g.shotSystem.shots[0]!;
    shot.x = 0x70 + 10;
    shot.y = 177;
    return { g, shot };
  }

  it("scores a brick and vanishes", () => {
    const { g, shot } = shotUnderBrick([0x21, 0x21]);
    const { score } = g.player;
    g.tick(idle);
    expect(g.player.score).toBe(score + 20);
    expect(g.sounds).toContain("bounce");
    expect(shot.state).toBe(BallState.Dead);
    expect(g.grid.cells[130]).toBe(0);
  });

  it("makes an indestructible brick blink, with the wall sound, and vanishes", () => {
    const { g, shot } = shotUnderBrick([0x08, 0x21]);
    const frame = g.grid.frames[130]!;
    g.tick(idle);
    expect(g.sounds).toContain("wall");
    expect(shot.state).toBe(BallState.Dead);
    expect(g.grid.frames[130]).not.toBe(frame);
  });

  it("is not moved by a teleporter, which still sounds and counts as a hit (0x4023AA)", () => {
    const { g, shot } = shotUnderBrick([0x18, 0x21]);
    g.tick(idle);
    expect(g.sounds).toContain("telepod");
    expect(shot.state).toBe(BallState.Dead);
    expect(shot.x).toBe(0x70 + 10);
    expect(shot.y).toBe(177 - 4);
  });

  it("clears the cannons on a lost life, the shots keep flying without hitting bricks", () => {
    const { g, shot } = shotUnderBrick([0x21, 0x21]);
    shot.y = 400;
    const ball = g.balls[0]!;
    g.magnet.on = false;
    ball.stuckOffset = null;
    dropBall(g);
    until(g, GameMode.LifeLost);
    expect(g.shotSystem.miniLeft.on).toBe(false);
    expect(g.shotSystem.miniRight.on).toBe(false);
    const { y } = shot;
    shot.x = 0x70 + 10;
    shot.y = 177;
    g.tick(idle);
    expect(shot.y).toBe(173);
    expect(y).toBeLessThan(400);
    expect(g.grid.cells[130]).toBe(1);
    expect(shot.state).toBe(BallState.Active);
  });

  it("empties the slots at the next round (0x40222D)", () => {
    const { g } = shotUnderBrick([0x21, 0x21]);
    g.magnet.on = false;
    g.balls[0]!.stuckOffset = null;
    dropBall(g);
    until(g, GameMode.LifeLost);
    until(g, GameMode.Arrival);
    expect(g.shotSystem.shots).toEqual([]);
  });
});

describe("monsters (§4.3)", () => {
  /** Serving game, ball stuck to the paddle. */
  function playing(levels?: Level[], over?: Partial<GameConfig>): Game {
    const g = game(levels ?? [level([0x24, 0x24]), level()], over);
    g.tick(fire);
    park(g);
    return g;
  }

  function monsterAt(g: Game, x: number, y: number) {
    spawnMonster(g.monsterSystem, g.level, new Rng(1));
    const m = g.monsterSystem.monsters.at(-1)!;
    m.x = x;
    m.y = y;
    return m;
  }

  function loseBall(g: Game): void {
    g.balls[0]!.stuckOffset = null;
    g.magnet.on = false;
    dropBall(g);
    for (let i = 0; i < 200 && g.mode === GameMode.Playing; i++) g.tick(idle);
  }

  it("spawn on the difficulty's timer, in mode 3 only (0x403A93)", () => {
    const g = game(undefined, { freqCreateMonster: [600, 3, 400] });
    ticks(g, 10);
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.monsterSystem.timer).toBe(0);
    g.tick(fire);
    park(g);
    expect(g.monsterSystem.timer).toBe(0);
    ticks(g, 2);
    expect(g.monsterSystem.monsters).toHaveLength(0);
    g.tick(idle);
    expect(g.monsterSystem.monsters).toHaveLength(1);
    // Spawned before 0x403C69 runs: already one step down.
    expect(g.monsterSystem.monsters[0]!.y).toBe(1);
    expect(g.monsterSystem.timer).toBe(0);
  });

  it("take the sprite of the level", () => {
    const g = playing();
    g.level = 6;
    expect(monsterAt(g, 200, 100).anim.first).toBe(monsterSprite(2));
  });

  it("hit by a ball: sound, 3 units of score and explosion (0x403D19)", () => {
    const g = playing();
    const b = g.balls[0]!;
    const m = monsterAt(g, b.x - 10, b.y - 10);
    const score = g.player.score;
    g.tick(idle);
    expect(m.state).toBe(BallState.Lost);
    expect(g.sounds).toContain("monstoff");
    expect(g.player.score).toBe(score + 40);
  });

  it("score double under points x2 (0x40841D)", () => {
    const g = playing();
    g.doubled = true;
    const b = g.balls[0]!;
    monsterAt(g, b.x - 10, b.y - 10);
    const score = g.player.score;
    g.tick(idle);
    expect(g.player.score).toBe(score + 80);
  });

  it("are tested at their place before they move: balls run first (0x401E4B, 0x401E55)", () => {
    const g = playing();
    // The stuck ball settles on its offset.
    g.tick(idle);
    const b = g.balls[0]!;
    const cx = b.x + 4;
    const m = monsterAt(g, cx + 1, b.y - 10);
    m.dx = -1;
    g.tick(idle);
    expect(m.state).toBe(BallState.Active);
    expect(m.x).toBe(cx);
    g.tick(idle);
    expect(m.state).toBe(BallState.Lost);
  });

  it("hit by a shot in mode 3: same score", () => {
    const g = playing();
    updateCannons(g.shotSystem, "mini_shoot", true, g.paddle);
    const shot = g.shotSystem.shots[0]!;
    shot.x = 300;
    shot.y = 300;
    const m = monsterAt(g, 290, 290);
    const score = g.player.score;
    g.tick(idle);
    expect(m.state).toBe(BallState.Lost);
    expect(g.player.score).toBe(score + 40);
  });

  it("bounce off every kind of brick without touching it or making a sound (0x40446A)", () => {
    for (const byte of [0x24, 0x09, 0x19]) {
      const g = playing([level([byte, 0, 0, 0, 0x24]), level()]);
      const m = monsterAt(g, 113, 127);
      const cells = g.grid.cells.slice();
      const frames = g.grid.frames.slice();
      const score = g.player.score;
      g.tick(idle);
      expect(m.dy).toBe(-1);
      expect(m.x).toBe(114);
      expect(g.grid.cells).toEqual(cells);
      expect(g.grid.frames).toEqual(frames);
      expect(g.player.score).toBe(score);
      expect(g.sounds).toEqual([]);
    }
  });

  it("go through the paddle without effect (0x4046D0)", () => {
    const g = playing();
    g.tick(idle);
    const m = monsterAt(g, g.paddle.x + 40, g.paddle.y - 30);
    const lives = g.player.lives;
    g.tick(idle);
    expect(m.dy).toBe(1);
    expect(m.stuckOffset).toBeNull();
    expect(g.player.lives).toBe(lives);
    expect(g.mode).toBe(GameMode.Playing);
  });

  it("go through bricks while the paddle explodes, hits are off (mode 5 or 6)", () => {
    const g = playing([level([0x24, 0, 0, 0, 0x24]), level()]);
    loseBall(g);
    expect(g.mode).toBe(GameMode.LifeLost);
    const m = monsterAt(g, 113, 127);
    g.tick(idle);
    expect(m.dy).toBe(1);
    expect(m.y).toBe(128);

    updateCannons(g.shotSystem, "mini_shoot", true, g.paddle);
    const shot = g.shotSystem.shots[0]!;
    shot.x = m.x + 10;
    shot.y = m.y + 10;
    const score = g.player.score;
    g.tick(idle);
    expect(m.state).toBe(BallState.Active);
    expect(g.player.score).toBe(score);
  });

  it("still see bricks and shots while the paddle leaves: mode stays 3 (0x401C54)", () => {
    const g = game([level([]), level([0x24])]);
    g.tick(idle);
    expect(g.mode).toBe(GameMode.LevelEnd);
    g.grid.cells[130] = 0x0c;
    const m = monsterAt(g, 113, 127);
    g.tick(idle);
    expect(m.dy).toBe(-1);

    updateCannons(g.shotSystem, "mini_shoot", true, g.paddle);
    const shot = g.shotSystem.shots[0]!;
    shot.x = m.x + 10;
    shot.y = m.y + 10;
    const score = g.player.score;
    g.tick(idle);
    expect(m.state).toBe(BallState.Lost);
    expect(g.player.score).toBe(score + 40);
  });

  it("animate and keep moving in the wait loops (0x402058)", () => {
    const g = playing();
    loseBall(g);
    const m = monsterAt(g, 200, 100);
    ticks(g, 6);
    expect(m.y).toBe(106);
    expect(m.anim.frame).toBe(m.anim.first + 33);
  });

  it("are all gone at the next round, timer cleared (0x40222D, 0x403A6F)", () => {
    const g = playing();
    monsterAt(g, 200, 100);
    g.monsterSystem.timer = 50;
    loseBall(g);
    for (let i = 0; i < 300 && g.mode !== GameMode.Ready; i++) g.tick(idle);
    expect(g.mode).toBe(GameMode.Ready);
    expect(g.monsterSystem.monsters).toHaveLength(0);
    expect(g.monsterSystem.timer).toBe(0);
  });

  it("freeze while fire holds the new game back after a game over (0x401FB4)", () => {
    const g = playing(undefined, { nbsLife: 1 });
    loseBall(g);
    for (let i = 0; i < 300 && g.mode !== GameMode.GameOverWait; i++) g.tick(idle);
    expect(g.mode).toBe(GameMode.GameOverWait);
    const m = monsterAt(g, 200, 100);
    for (let i = 0; i < 5; i++) g.tick(fire);
    expect(m.y).toBe(100);
  });

  it("frees its slot for a new monster once the explosion is over", () => {
    const g = playing();
    const b = g.balls[0]!;
    const m = monsterAt(g, b.x - 10, b.y - 10);
    g.tick(idle);
    expect(m.state).toBe(BallState.Lost);
    ticks(g, 26);
    expect(m.state).toBe(BallState.Lost);
    g.tick(idle);
    expect(m.state).toBe(BallState.Dead);
  });
});

describe("clamp before drawing (0x406874)", () => {
  it("puts a ball out of bounds back in, in mode 3", () => {
    const g = game();
    g.tick(fire);
    const b = g.balls[0]!;
    b.stuckOffset = null;
    g.magnet.on = false;
    b.x = 100;
    b.y = 300;
    g.tick(idle);
    expect(b.x).toBe(112);
  });

  it("keeps an explosion inside the play area", () => {
    const g = game();
    g.tick(fire);
    park(g);
    spawnMonster(g.monsterSystem, 1, new Rng(1));
    const m = g.monsterSystem.monsters[0]!;
    const b = g.balls[0]!;
    m.x = 112;
    m.y = b.y - 10;
    b.stuckOffset = null;
    g.magnet.on = false;
    b.x = 120;
    g.tick(idle);
    expect(m.state).toBe(BallState.Lost);
    expect(m.x).toBe(112);
  });
});
