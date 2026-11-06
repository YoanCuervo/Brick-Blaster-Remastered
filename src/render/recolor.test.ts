import { describe, expect, it } from "vitest";
import { lowPixels, recolor } from "./recolor";

// Three RGBA pixels: mask indices 0, 3, 15.
const mask = Uint8ClampedArray.from([0, 0, 0, 255, 3, 3, 3, 255, 15, 15, 15, 255]);
const sheet = Uint8ClampedArray.from([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255]);
const colors = Array.from({ length: 16 }, (_, i) => [i, i * 2, i * 3] as const);

describe("lowPixels", () => {
  it("keeps only pixels of index 1..15 with their offset", () => {
    const low = lowPixels(mask);
    expect([...low.offsets]).toEqual([4, 8]);
    expect([...low.indices]).toEqual([3, 15]);
  });
});

describe("recolor (§3.5, 0x407430)", () => {
  it("gives pixels of index 1..15 the background colour, alpha kept", () => {
    const out = recolor(sheet, lowPixels(mask), colors);
    expect([...out]).toEqual([1, 2, 3, 255, 3, 6, 9, 255, 15, 30, 45, 255]);
  });

  it("leaves the world sheet untouched", () => {
    recolor(sheet, lowPixels(mask), colors);
    expect(sheet[4]).toBe(4);
  });
});
