import { describe, expect, it } from "vitest";
import {
  type Ball,
  BallState,
  type BrickProbe,
  accelerate,
  antiLoop,
  brickSweep,
  createBall,
  flipX,
  lostCheck,
  paddleBounce,
  placeOnPaddle,
  sampleCount,
  sweepTrack,
  updateBall,
  wallBounce,
} from "./ball";
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
