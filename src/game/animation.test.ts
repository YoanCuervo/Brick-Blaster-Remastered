import { describe, expect, it } from "vitest";
import { ANIM_END_LEFT, EXPLOSION, WARP, createAnim, stepAnim } from "./animation";

/** Frame index shown after each tick, until [+0x65] reaches 2. */
function run(spec: typeof EXPLOSION): number[] {
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
