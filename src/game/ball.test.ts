import { describe, expect, it } from "vitest";
import {
  BALL_SPRITE,
  type Ball,
  BallState,
  type BrickProbe,
  MAX_BALLS,
  accelerate,
  addBalls,
  antiLoop,
  brickSweep,
  createBall,
  extraBallSpeed,
  flipX,
  lostCheck,
  makeGhosts,
  makeIron,
  moveBall,
  paddleBounce,
  placeExtraBall,
  placeOnPaddle,
  sampleCount,
  slowDown,
  stepBallAnim,
  stickToPaddle,
  sweepTrack,
  updateBall,
  wallBounce,
} from "./ball";
import { Rng } from "../core/rng";
import { LEVEL_COLS, LEVEL_ROWS } from "../data/levels";
import { createPaddle } from "./paddle";

function ball(props: Partial<Ball> = {}): Ball {
  return Object.assign(createBall(1500), props);
}

const noBricks: BrickProbe = { hit: () => false };

/** Probe answering per corner: the sweep probes the first corner, then the second. */
function cornerProbe(first: boolean[], second: boolean[]) {
  const calls: [number, number][] = [];
  let i = 0;
  const probe: BrickProbe = {
    hit(x, y) {
      calls.push([x, y]);
      const step = i >> 1;
      const hit = (i & 1 ? second : first)[step] ?? false;
      i++;
      return hit;
    },
  };
  return { probe, calls };
}

describe("createBall / placeOnPaddle (0x40225E, 0x404FDC)", () => {
  it("is a 9 × 9 ball bounded by the play area", () => {
    const b = createBall(1500);
    expect(b).toMatchObject({ w: 9, h: 9, xMin: 112, xMax: 519, yMin: 0, yMax: 471 });
    expect(b.speedCounter).toBe(1500);
  });

  it("sits centred on the paddle", () => {
    const b = ball();
    placeOnPaddle(b, createPaddle());
    expect(b.y).toBe(416 - 9);
    expect(b.x).toBe(283 + 37 - 4);
  });
});

describe("brick sweep sub-steps (0x404098, 0x4041D2)", () => {
  it("uses max(|dx|, |dy|) + 1 samples, capped at 18", () => {
    expect(sampleCount(3, -4)).toBe(5);
    expect(sampleCount(16, 0)).toBe(17);
    expect(sampleCount(17, 2)).toBe(18);
    expect(sampleCount(30, 2)).toBe(18);
    expect(sampleCount(0, 0)).toBe(0);
  });

  it("walks in 16.16 fixed point and ends exactly on the target", () => {
    expect(sweepTrack(100, 104, 5)).toEqual([null, 101, 102, 103, 104]);
    expect(sweepTrack(0, 3, 5)).toEqual([null, 0, 1, 2, 3]);
    expect(sweepTrack(10, 7, 5)).toEqual([null, 9, 8, 7, 7]);
  });

  it("probes the two corners on the leading side", () => {
    const b = ball({ x: 200, y: 200, dx: 2, dy: 3 });
    const { probe, calls } = cornerProbe([], []);
    brickSweep(b, probe);
    // n = 4: sample 0 is never probed, then 3 samples × 2 corners.
    expect(calls).toHaveLength(6);
    expect(calls.slice(-2)).toEqual([
      [211, 203],
      [202, 212],
    ]);

    const up = ball({ x: 200, y: 200, dx: 2, dy: -3 });
    const other = cornerProbe([], []);
    brickSweep(up, other.probe);
    expect(other.calls.slice(-2)).toEqual([
      [202, 197],
      [211, 206],
    ]);
  });

  it("does not probe a still ball", () => {
    const { probe, calls } = cornerProbe([], []);
    expect(brickSweep(ball({ x: 200, y: 200 }), probe)).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("bounce codes (0x40436A)", () => {
  const cases: [number, number, boolean, boolean, number, number, number][] = [
    // dx, dy, first corner, second corner, code, new dx, new dy
    [2, 3, true, false, 1, -2, 3],
    [2, 3, false, true, 2, 2, -3],
    [2, 3, true, true, 3, -2, -3],
    [-2, 3, true, false, 5, 2, 3],
    [-2, 3, false, true, 6, -2, -3],
    [2, -3, true, false, 9, 2, 3],
    [2, -3, false, true, 10, -2, -3],
    [-2, -3, true, false, 13, -2, 3],
    [-2, -3, false, true, 14, 2, -3],
    [-2, -3, true, true, 15, 2, 3],
  ];
  it.each(cases)("dx %i dy %i hits %s/%s → code %i", (dx, dy, a, c, code, ndx, ndy) => {
    const b = ball({ x: 200, y: 200, dx, dy });
    const { probe } = cornerProbe([a], [c]);
    expect(brickSweep(b, probe)).toBe(code);
    expect([b.dx, b.dy]).toEqual([ndx, ndy]);
  });

  it("the first sample that hits decides, later ones are still probed", () => {
    const b = ball({ x: 200, y: 200, dx: 2, dy: 3 });
    const { probe, calls } = cornerProbe([true], [false, false, true]);
    expect(brickSweep(b, probe)).toBe(1);
    expect(calls).toHaveLength(6);
  });

  it("an iron ball probes but never bounces", () => {
    const b = ball({ x: 200, y: 200, dx: 2, dy: 3, bouncesOnBricks: false });
    const { probe, calls } = cornerProbe([true], [true]);
    expect(brickSweep(b, probe)).toBe(0);
    expect([b.dx, b.dy]).toEqual([2, 3]);
    expect(calls).toHaveLength(6);
  });
});

describe("walls (0x404022)", () => {
  it("reverses when the next position reaches a bound", () => {
    const left = ball({ x: 118, y: 200, dx: -6, dy: 0 });
    wallBounce(left);
    expect(left.dx).toBe(6);
    const right = ball({ x: 515, y: 200, dx: 4, dy: 0 });
    wallBounce(right);
    expect(right.dx).toBe(-4);
    const inside = ball({ x: 300, y: 200, dx: 4, dy: 3 });
    wallBounce(inside);
    expect([inside.dx, inside.dy]).toEqual([4, 3]);
  });

  it("bounces off the top and the bottom of the screen", () => {
    const top = ball({ x: 300, y: 2, dx: 0, dy: -3 });
    wallBounce(top);
    expect(top.dy).toBe(3);
    const bottom = ball({ x: 300, y: 468, dx: 0, dy: 3 });
    wallBounce(bottom);
    expect(bottom.dy).toBe(-3);
  });
});

describe("paddle bounce (0x404610)", () => {
  // Paddle spans x = 283..356; back/front edges are 23 px wide.
  const hit = (props: Partial<Ball>) => {
    const b = ball({ y: 407, mode: 0, ...props });
    const bounced = paddleBounce(b, createPaddle());
    return { b, bounced };
  };

  it("moving right: back edge sends the ball back", () => {
    const { b, bounced } = hit({ x: 290, dx: 4, dy: 3 });
    expect(bounced).toBe(true);
    expect([b.dx, b.dy, b.mode]).toEqual([-4, -3, 0]);
  });

  it("moving right: front edge flattens the angle", () => {
    const { b } = hit({ x: 330, dx: 4, dy: 5 });
    expect([b.dx, b.dy, b.mode]).toEqual([5, -4, 1]);
  });

  it("moving right: centre restores the steep angle", () => {
    const { b } = hit({ x: 310, dx: 5, dy: 4, mode: 1 });
    expect([b.dx, b.dy, b.mode]).toEqual([4, -5, 0]);
    const steep = hit({ x: 310, dx: 4, dy: 5 }).b;
    expect([steep.dx, steep.dy, steep.mode]).toEqual([4, -5, 0]);
  });

  it("moving left mirrors the zones, judged on the ball's left edge", () => {
    expect(hit({ x: 340, dx: -4, dy: 3 }).b.dx).toBe(4);
    const front = hit({ x: 290, dx: -4, dy: 5 }).b;
    expect([front.dx, front.dy, front.mode]).toEqual([-5, -4, 1]);
    const centre = hit({ x: 310, dx: -5, dy: 4, mode: 1 }).b;
    expect([centre.dx, centre.dy, centre.mode]).toEqual([-4, -5, 0]);
  });

  it("no flat angle once |dx| reaches 14", () => {
    const { b } = hit({ x: 330, dx: 14, dy: 2 });
    expect([b.dx, b.dy, b.mode]).toEqual([14, -2, 0]);
  });

  it("ignores rising balls and balls beside the paddle", () => {
    expect(hit({ x: 310, dx: 4, dy: -3 }).bounced).toBe(false);
    expect(hit({ x: 273, dx: 4, dy: 3 }).bounced).toBe(false);
    expect(hit({ x: 357, dx: 4, dy: 3 }).bounced).toBe(false);
    expect(hit({ x: 310, y: 406, dx: 4, dy: 3 }).bounced).toBe(false);
  });

  it("has no lower bound: a ball already below the top still bounces", () => {
    expect(hit({ x: 310, y: 440, dx: 4, dy: 3 }).bounced).toBe(true);
  });
});

describe("lost ball (0x4049B5)", () => {
  it("is marked lost when its centre passes y = 428 going down", () => {
    const b = ball({ x: 300, y: 423, dy: 3 });
    expect(lostCheck(b)).toBe(false);
    expect(b.state).toBe(BallState.Active);
    b.y = 424;
    expect(lostCheck(b)).toBe(false);
    expect(b.state).toBe(BallState.Lost);
  });

  it("disappears once it stops falling, after the bottom bounce", () => {
    const b = ball({ x: 300, y: 471, dy: -3, state: BallState.Lost });
    expect(lostCheck(b)).toBe(true);
    expect(b.state).toBe(BallState.Dead);
  });

  it("a lost ball no longer sees the paddle", () => {
    const b = ball({ x: 310, y: 430, dx: 2, dy: 3, state: BallState.Lost });
    const events = updateBall(b, createPaddle(), noBricks, 1500);
    expect(events).not.toContain("paddle");
    expect(b.dy).toBe(3);
  });

  it("a whole fall: marked, bounces off the bottom, then gone", () => {
    const b = ball({ x: 200, y: 400, dx: 0, dy: 5 });
    const events: string[] = [];
    for (let t = 0; t < 30 && b.state !== BallState.Dead; t++) {
      events.push(...updateBall(b, createPaddle(), noBricks, 1500));
    }
    expect(b.state).toBe(BallState.Dead);
    expect(events).toEqual(["lost"]);
  });
});

describe("acceleration (0x403F50)", () => {
  it("counts down only while climbing, then speeds up and reloads", () => {
    const b = ball({ dx: 3, dy: -4, speedCounter: 2 });
    expect(accelerate(b, 1483)).toBe(false);
    b.dy = 4;
    expect(accelerate(b, 1483)).toBe(false);
    expect(b.speedCounter).toBe(1);
    b.dy = -4;
    expect(accelerate(b, 1483)).toBe(true);
    expect([b.dx, b.dy, b.speedCounter]).toEqual([4, -5, 1483]);
  });

  it("caps |dx| below 14 + mode and |dy| below 15 − mode", () => {
    const steep = ball({ dx: -14, dy: -14, speedCounter: 1 });
    accelerate(steep, 10);
    expect([steep.dx, steep.dy]).toEqual([-14, -15]);
    const flat = ball({ dx: 14, dy: -14, mode: 1, speedCounter: 1 });
    accelerate(flat, 10);
    expect([flat.dx, flat.dy]).toEqual([15, -14]);
  });
});

describe("anti-loop guard (0x4051E3)", () => {
  it("switches the angle after the position repeats 3 times", () => {
    const b = ball({ x: 200, y: 200, dx: 3, dy: 4 });
    flipX(b);
    flipX(b);
    expect(b.mode).toBe(0);
    flipX(b);
    // Third match: flatter with the sign of dx (−3 → −4), dy incremented as such.
    expect([b.dx, b.dy, b.mode]).toEqual([-4, 5, 1]);
  });

  it("does nothing while the ball keeps moving", () => {
    const b = ball({ x: 200, y: 200, dx: 3, dy: 4 });
    for (let i = 0; i < 59; i++) {
      antiLoop(b);
      b.x++;
    }
    expect(b.mode).toBe(0);
    expect(b.loopMatches).toBe(1);
  });

  it("takes a new snapshot every 60 reversals", () => {
    const b = ball({ x: 200, y: 200, dx: 3, dy: 4 });
    for (let i = 0; i < 60; i++) {
      antiLoop(b);
      b.x++;
    }
    expect(b.loopCount).toBe(60);
    antiLoop(b);
    expect([b.loopCount, b.loopX, b.loopMatches]).toEqual([1, 260, 1]);
  });
});

describe("updateBall order (0x403932)", () => {
  it("bounces on the paddle, then moves with the new velocity", () => {
    const b = ball({ x: 310, y: 407, dx: 4, dy: 5 });
    const events = updateBall(b, createPaddle(), noBricks, 1500);
    expect(events).toContain("paddle");
    expect([b.x, b.y]).toEqual([314, 402]);
  });

  it("a dead ball does not move", () => {
    const b = ball({ x: 300, y: 300, dx: 4, dy: 5, state: BallState.Dead });
    updateBall(b, createPaddle(), noBricks, 1500);
    expect([b.x, b.y]).toEqual([300, 300]);
  });
});

describe("ball stuck to the paddle (0x4048F7, 0x403D8E)", () => {
  it("keeps the offset within the paddle", () => {
    const p = createPaddle();
    const b = ball({ x: p.x + 33 });
    stickToPaddle(b, p);
    expect(b.stuckOffset).toBe(33);
    const far = ball({ x: p.x + 200 });
    stickToPaddle(far, p);
    expect(far.stuckOffset).toBe(p.w - 9);
  });

  it("follows the paddle until fire, then moves on the same tick", () => {
    const p = createPaddle();
    const b = ball({ dx: 3, dy: -4, stuckOffset: 33 });
    p.x = 200;
    const magnet = { on: true };
    moveBall(b, p, magnet, false);
    expect([b.x, b.y]).toEqual([233, 0x1a0 - 9]);
    moveBall(b, p, magnet, true);
    expect(b.stuckOffset).toBeNull();
    expect(magnet.on).toBe(false);
    expect([b.x, b.y]).toEqual([236, 0x1a0 - 13]);
  });

  it("lets the other stuck balls leave once the magnet is off (0x403E0C)", () => {
    const p = createPaddle();
    const a = ball({ dx: 3, dy: -4, stuckOffset: 10 });
    const b = ball({ dx: 2, dy: -5, x: 300, y: 300, stuckOffset: 20 });
    const magnet = { on: true };
    moveBall(a, p, magnet, true);
    moveBall(b, p, magnet, true);
    expect(b.stuckOffset).toBe(20);
    expect([b.x, b.y]).toEqual([302, 295]);
    // The offset survives: a new magnet takes the ball back.
    magnet.on = true;
    moveBall(b, p, magnet, false);
    expect(b.x).toBe(p.x + 20);
  });

  it("sticks at the paddle contact with the magnet on, keeping the bounce (0x4048C9)", () => {
    const p = createPaddle();
    const b = ball({ x: p.x + 30, y: 0x1a0 - 9, dx: 3, dy: 4 });
    expect(paddleBounce(b, p, { on: true })).toBe(true);
    expect(b.stuckOffset).toBe(30);
    expect(b.dy).toBe(-4);
  });

  it("clears the stuck state at a contact with the magnet off (0x4048D5)", () => {
    const p = createPaddle();
    const b = ball({ x: p.x + 30, y: 0x1a0 - 9, dx: 3, dy: 4, stuckOffset: 7 });
    expect(paddleBounce(b, p, { on: false })).toBe(true);
    expect(b.stuckOffset).toBeNull();
  });
});

class ScriptedRng extends Rng {
  constructor(private readonly values: number[]) {
    super(0);
  }
  override rand(): number {
    return this.values.shift() ?? 0;
  }
}

const emptyLevel = Array.from({ length: LEVEL_ROWS }, () => new Array<number>(LEVEL_COLS).fill(0));

describe("extra balls (0x40240E)", () => {
  it("draws 2..4 + 1 going up, in steep mode (0x4024C0)", () => {
    const b = ball();
    extraBallSpeed(b, new ScriptedRng([2, 0, 0, 0, 0]));
    expect([b.dx, b.dy, b.mode]).toEqual([4, -5, 0]);
  });

  it("slows dx by one on the first coin", () => {
    const b = ball();
    extraBallSpeed(b, new ScriptedRng([0, 1, 0, 0, 0]));
    expect([b.dx, b.dy, b.mode]).toEqual([1, -3, 0]);
  });

  it("goes flat on the second coin", () => {
    const b = ball();
    extraBallSpeed(b, new ScriptedRng([0, 0, 1, 0, 0]));
    expect([b.dx, b.dy, b.mode]).toEqual([3, -2, 1]);
  });

  it("can go left, and always goes up whatever the last coin (0x402440)", () => {
    const b = ball();
    extraBallSpeed(b, new ScriptedRng([0, 0, 0, 1, 1]));
    expect([b.dx, b.dy]).toEqual([-2, -3]);
  });

  it("appears above the paddle, 9 px from its ends (0x40244E)", () => {
    const p = createPaddle();
    const low = ball();
    placeExtraBall(low, p, emptyLevel, new ScriptedRng([0, 0]));
    expect([low.x, low.y]).toEqual([p.x + 9, 382]);
    const high = ball();
    placeExtraBall(high, p, emptyLevel, new ScriptedRng([p.w - 18, 25]));
    expect([high.x, high.y]).toEqual([p.x + p.w - 9, 407]);
  });

  it("draws again on an indestructible brick (0x40252D)", () => {
    const p = createPaddle();
    const lvl = emptyLevel.map((row) => [...row]);
    const col = (p.x + 9 - 112) >> 5;
    lvl[23]![col] = 0x08;
    const b = ball();
    // First spot has a corner on row 23, the second is clear of it.
    placeExtraBall(b, p, lvl, new ScriptedRng([0, 0, 0, 20]));
    expect([b.x, b.y]).toEqual([p.x + 9, 402]);
  });

  it("uses the slots not in play, a ball about to be lost included", () => {
    const active = ball();
    const lost = ball({ state: BallState.Lost });
    const dead = ball({ state: BallState.Dead });
    const balls = [active, lost, dead];
    addBalls(balls, 2, createPaddle(), emptyLevel, 1500, new Rng(1));
    expect(balls).toHaveLength(3);
    expect(balls[0]).toBe(active);
    expect(balls[1]).not.toBe(lost);
    expect(balls[2]).not.toBe(dead);
    expect(balls[1]!.state).toBe(BallState.Active);
    expect(balls[1]!.speedCounter).toBe(1500);
  });

  it("stops at 20 balls", () => {
    const balls = [ball()];
    addBalls(balls, 20, createPaddle(), emptyLevel, 1500, new Rng(1));
    expect(balls).toHaveLength(MAX_BALLS);
    expect(MAX_BALLS).toBe(20);
  });
});

describe("fast ball, for one tick (0x403F5F)", () => {
  it("speeds up and reloads the counter, even going down, silently", () => {
    const b = ball({ dx: 3, dy: 4, speedCounter: 50 });
    expect(accelerate(b, 1483, true)).toBe(false);
    expect([b.dx, b.dy]).toEqual([4, 5]);
    expect(b.speedCounter).toBe(1483);
  });

  it("speeds up only once when the counter ends on that tick, with the sound (0x403F7E)", () => {
    const b = ball({ dx: 3, dy: -4, speedCounter: 1 });
    expect(accelerate(b, 1483, true)).toBe(true);
    expect([b.dx, b.dy]).toEqual([4, -5]);
    expect(b.speedCounter).toBe(1483);
  });

  it("gets a dying ghost ball moving: a null dx counts as positive (0x404963)", () => {
    const b = ball({ dx: 0, dy: 0 });
    accelerate(b, 1483, true);
    expect([b.dx, b.dy]).toEqual([1, 1]);
  });
});

describe("slow ball, for one tick (0x403F8D)", () => {
  it("slows down and reloads the counter", () => {
    const b = ball({ dx: 5, dy: -6, speedCounter: 50 });
    slowDown(b, 1483);
    expect([b.dx, b.dy]).toEqual([4, -5]);
    expect(b.speedCounter).toBe(1483);
  });

  it("stops at |dx| = 1 + mode and |dy| = 2 - mode (0x403FE6, 0x404004)", () => {
    const steep = ball({ dx: -1, dy: 2, mode: 0 });
    slowDown(steep, 10);
    expect([steep.dx, steep.dy]).toEqual([-1, 2]);
    const flat = ball({ dx: 2, dy: -1, mode: 1 });
    slowDown(flat, 10);
    expect([flat.dx, flat.dy]).toEqual([2, -1]);
    const moving = ball({ dx: -3, dy: 2, mode: 1 });
    slowDown(moving, 10);
    expect([moving.dx, moving.dy]).toEqual([-2, 1]);
  });
});

describe("one-tick bonuses in the ball loop (0x403932)", () => {
  it("telepod teleports after the move, without changing the speed", () => {
    const b = ball({ x: 300, y: 200, dx: 3, dy: -4 });
    const seen: number[][] = [];
    const teleport = (t: Ball) => {
      seen.push([t.x, t.y]);
      t.x = 250;
      t.y = 150;
    };
    updateBall(b, createPaddle(), noBricks, 1500, { active: "telepod", teleport });
    expect(seen).toEqual([[303, 196]]);
    expect([b.x, b.y, b.dx, b.dy]).toEqual([250, 150, 3, -4]);
  });

  it("telepod also takes a ball about to be lost, before its lost check (0x4039AA)", () => {
    const b = ball({ x: 300, y: 450, dx: 3, dy: -4, state: BallState.Lost });
    const teleport = (t: Ball) => {
      t.y = 150;
    };
    updateBall(b, createPaddle(), noBricks, 1500, { active: "telepod", teleport });
    expect(b.y).toBe(150);
    expect(b.state).toBe(BallState.Dead);
  });

  it("iron goes through bricks from then on, on every ball in play", () => {
    const b = ball({ x: 300, y: 200, dx: 3, dy: -4 });
    updateBall(b, createPaddle(), noBricks, 1500, { active: "iron_ball" });
    expect(b.bouncesOnBricks).toBe(false);
    expect(b.anim.frame).toBe(0);
    updateBall(b, createPaddle(), noBricks, 1500);
    expect(b.bouncesOnBricks).toBe(false);
  });

  it("iron skips a ball about to be lost (0x403936)", () => {
    const b = ball({ x: 300, y: 450, dx: 0, dy: 3, state: BallState.Lost });
    updateBall(b, createPaddle(), noBricks, 1500, { active: "iron_ball" });
    expect(b.bouncesOnBricks).toBe(true);
    expect(b.anim.frame).toBe(BALL_SPRITE);
  });

  it("iron keeps a ghost ball looking ghost (0x403975)", () => {
    const b = ball({ ghost: true });
    makeIron(b);
    expect(b.anim.first).toBe(0x12);
    expect(b.anim.frame).toBe(0x12);
  });

  it("fast and slow also apply to a ball about to be lost", () => {
    const f = ball({ x: 300, y: 300, dx: 3, dy: 4, state: BallState.Lost });
    updateBall(f, createPaddle(), noBricks, 1500, { active: "fast_ball" });
    expect([f.dx, f.dy]).toEqual([4, 5]);
    const s = ball({ x: 300, y: 300, dx: 3, dy: 4, state: BallState.Lost });
    updateBall(s, createPaddle(), noBricks, 1500, { active: "slow_ball" });
    expect([s.dx, s.dy]).toEqual([2, 3]);
  });
});

describe("ghost balls (0x403ED5, 0x4046C7)", () => {
  it("marks every ball but the first in play (0x403F16)", () => {
    const dead = ball({ state: BallState.Dead });
    const first = ball();
    const other = ball();
    const iron = ball();
    makeIron(iron);
    makeGhosts([dead, first, other, iron]);
    expect(dead.ghost).toBe(true);
    expect(first.ghost).toBe(false);
    expect(first.anim.frame).toBe(BALL_SPRITE);
    expect(other.ghost).toBe(true);
    expect(other.anim.frame).toBe(0x1692);
    expect(other.anim.first).toBe(0x1692);
    expect(iron.anim.frame).toBe(0x12);
  });

  it("does not mark a ghost twice, and frees the first ball in play again", () => {
    const first = ball();
    const other = ball();
    makeGhosts([first, other]);
    makeGhosts([first, other]);
    expect(first.ghost).toBe(false);
    expect(first.anim.frame).toBe(BALL_SPRITE);
    expect(other.anim.frame).toBe(0x1692);
  });

  function ghostOnPaddle(props: Partial<Ball> = {}) {
    const p = createPaddle();
    const b = ball({ x: p.x + 30, y: 0x1a0 - 9, dx: 3, dy: 4, ...props });
    makeGhosts([ball(), b]);
    return { p, b };
  }

  it("dies at the paddle contact: no bounce, no stick, speed zero (0x40465C)", () => {
    const { p, b } = ghostOnPaddle();
    expect(paddleBounce(b, p, { on: true })).toBe(false);
    expect([b.dx, b.dy]).toEqual([0, 0]);
    expect(b.stuckOffset).toBeNull();
    expect(b.dying).toBe(7);
    expect(b.anim).toMatchObject({
      first: 0x16ae,
      frame: 0x16ae,
      frames: 5,
      left: 1,
      delay: 1,
      countdown: 1,
      step: 10,
    });
  });

  it("uses the iron death sprite for an iron ghost", () => {
    const { p, b } = ghostOnPaddle();
    makeIron(b);
    paddleBounce(b, p);
    expect(b.anim.frame).toBe(0x2e);
  });

  it("does not restart a death already running (0x404660)", () => {
    const { p, b } = ghostOnPaddle();
    paddleBounce(b, p);
    stepBallAnim(b);
    stepBallAnim(b);
    b.dy = 1;
    const { dying } = b;
    paddleBounce(b, p);
    expect(b.dying).toBe(dying);
    expect(b.dy).toBe(1);
  });

  it("disappears after 6 anim steps, 12 stepper ticks (0x406708)", () => {
    const { p, b } = ghostOnPaddle();
    paddleBounce(b, p);
    for (let i = 0; i < 11; i++) {
      stepBallAnim(b);
      expect(b.state).toBe(BallState.Active);
    }
    stepBallAnim(b);
    expect(b.state).toBe(BallState.Dead);
  });

  it("walks its 5 frames, 10 px apart", () => {
    const { p, b } = ghostOnPaddle();
    paddleBounce(b, p);
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) {
      stepBallAnim(b);
      seen.push(b.anim.frame);
    }
    expect(seen).toEqual([
      0x16ae,
      0x16ae,
      0x16ae,
      0x16ae + 10,
      0x16ae + 10,
      0x16ae + 20,
      0x16ae + 20,
      0x16ae + 30,
      0x16ae + 30,
      0x16ae + 40,
    ]);
  });
});
