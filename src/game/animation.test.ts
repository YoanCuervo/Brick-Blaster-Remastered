import { describe, expect, it } from "vitest";
import {
  ANIM_END_LEFT,
  ARRIVAL,
  type AnimSpec,
  PaddleSprite,
  createAnim,
  explosionOf,
  stepAnim,
  warpOf,
} from "./animation";

const { spec: EXPLOSION } = explosionOf(PaddleSprite.Normal);
const { spec: WARP } = warpOf(PaddleSprite.Normal);

/** Frame index shown after each tick, until [+0x65] reaches 2. */
function run(spec: AnimSpec): number[] {
  const a = createAnim(spec);
  const frames: number[] = [];
  do {
    stepAnim(a);
    frames.push((a.frame - a.first) / a.step);
  } while (a.left !== ANIM_END_LEFT);
  return frames;
}

describe("stepAnim (0x4066BA)", () => {
  it("plays the paddle explosion over 35 ticks, 5 per frame", () => {
    const frames = run(EXPLOSION);
    expect(frames.length).toBe(35);
    expect(frames.slice(0, 9)).toEqual(Array(9).fill(0));
    expect(frames.slice(9, 14)).toEqual(Array(5).fill(1));
    expect(frames.at(-1)).toBe(6);
  });

  it("plays the paddle warp over 18 ticks, 2 per frame", () => {
    const frames = run(WARP);
    expect(frames.length).toBe(18);
    expect(frames.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(frames.at(-1)).toBe(8);
  });

  it("plays the paddle arrival like the warp, from its own strip (0x404B88)", () => {
    expect(ARRIVAL.spec).toEqual({ ...WARP, first: 0x89242 });
    expect(ARRIVAL.dx).toBe(-9);
    expect(run(ARRIVAL.spec).length).toBe(18);
  });

  it("reports the ticks with a step, and stays still with one frame", () => {
    const a = createAnim({ ...WARP, delay: 1, countdown: 1 });
    expect([stepAnim(a), stepAnim(a), stepAnim(a), stepAnim(a)]).toEqual([
      false,
      true,
      false,
      true,
    ]);
    a.frames = 1;
    const { frame } = a;
    expect(stepAnim(a)).toBe(false);
    expect(stepAnim(a)).toBe(false);
    expect(a.frame).toBe(frame);
  });

  it("wraps to the first frame after the last", () => {
    const a = createAnim({ ...WARP, frames: 2, delay: 0, countdown: 0 });
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      stepAnim(a);
      seen.push((a.frame - a.first) / a.step);
    }
    expect(seen).toEqual([0, 1, 0, 1, 0]);
  });
});

describe("paddle effects by sprite (0x4030DC, 0x4032B4)", () => {
  it("picks the explosion of each paddle", () => {
    expect(explosionOf(PaddleSprite.Normal)).toMatchObject({
      dx: -0x15,
      spec: { first: 0x1c701, w: 0x76, h: 0x46, step: 0xb180, frames: 8, delay: 4 },
    });
    expect(explosionOf(PaddleSprite.Large)).toMatchObject({
      dx: -0x13,
      spec: { first: 0x1c7d5, w: 0x8f },
    });
    expect(explosionOf(PaddleSprite.Small)).toMatchObject({
      dx: -0x1b,
      spec: { first: 0x1c778, w: 0x5c },
    });
  });

  it("picks the warp of each paddle", () => {
    expect(warpOf(PaddleSprite.Normal)).toMatchObject({
      dx: -9,
      spec: { first: 0x891e5, w: 0x5c, h: 0x2b, step: 0x6e00, frames: 10, delay: 1 },
    });
    expect(warpOf(PaddleSprite.Large)).toMatchObject({
      dx: -0xb,
      spec: { first: 0xe1c81, w: 0x7f },
    });
    expect(warpOf(PaddleSprite.Small)).toMatchObject({
      dx: -0x1b,
      spec: { first: 0x8929f, w: 0x5c },
    });
  });
});
