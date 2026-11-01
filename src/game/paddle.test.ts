import { describe, expect, it } from "vitest";
import { stepAnim } from "./animation";
import {
  PADDLE_LARGE,
  PADDLE_SMALL,
  PADDLE_X_MIN,
  createPaddle,
  movePaddle,
  paddleMaxX,
  setPaddleSize,
} from "./paddle";

describe("paddle (0x4025B0)", () => {
  it("starts centred, 74 × 25, at y = 416", () => {
    const p = createPaddle();
    expect(p).toMatchObject({ x: 283, y: 416, w: 74 });
    expect(p.x + p.w / 2).toBe(320);
  });

  it("stays between x = 112 and 528 − width", () => {
    const p = createPaddle();
    movePaddle(p, -1000);
    expect(p.x).toBe(PADDLE_X_MIN);
    movePaddle(p, 1000);
    expect(p.x).toBe(528 - 74);
    expect(paddleMaxX(p)).toBe(454);
  });

  it("follows the paddle width for the right bound", () => {
    const p = createPaddle();
    p.w = 0x26;
    movePaddle(p, 1000);
    expect(p.x).toBe(528 - 0x26);
  });

  it("moves by the given step inside the area", () => {
    const p = createPaddle();
    movePaddle(p, -5);
    expect(p.x).toBe(278);
  });
});

describe("paddle sizes and animation (0x4025B0, 0x4033F3, 0x4034FB)", () => {
  it("animates the normal paddle over 4 frames side by side, one step per 6 ticks", () => {
    const { anim } = createPaddle();
    expect(anim).toMatchObject({ first: 0x6900, frames: 4, delay: 5, countdown: 5, step: 74 });
    const seen: number[] = [];
    for (let i = 0; i < 18; i++) {
      stepAnim(anim);
      seen.push((anim.frame - anim.first) / anim.step);
    }
    // The first step only rewinds, as for every object.
    expect(seen.slice(0, 11)).toEqual(Array(11).fill(0));
    expect(seen.slice(11, 17)).toEqual(Array(6).fill(1));
    expect(seen[17]).toBe(2);
  });

  it("has a large one of 105 px and a small one of 38 px, 2 frames each", () => {
    const p = createPaddle();
    setPaddleSize(p, PADDLE_LARGE);
    expect(p.w).toBe(105);
    expect(p.anim).toMatchObject({ first: 0x6a28, frames: 2, delay: 0xa, left: 1, step: 105 });
    expect(paddleMaxX(p)).toBe(0x210 - 105);
    setPaddleSize(p, PADDLE_SMALL);
    expect(p.w).toBe(38);
    expect(p.anim).toMatchObject({ first: 0x6afa, frames: 2, delay: 8, left: 1, step: 38 });
  });

  it("clamps the old x with the next move", () => {
    const p = createPaddle();
    p.x = 454;
    setPaddleSize(p, PADDLE_LARGE);
    expect(p.x).toBe(454);
    movePaddle(p, 0);
    expect(p.x).toBe(0x210 - 105);
  });
});
