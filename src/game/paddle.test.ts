import { describe, expect, it } from "vitest";
import { PADDLE_X_MIN, createPaddle, movePaddle, paddleMaxX } from "./paddle";

describe("paddle (0x4025B0)", () => {
  it("starts centred, 74 × 25, at y = 416", () => {
    const p = createPaddle();
    expect(p).toEqual({ x: 283, y: 416, w: 74 });
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
