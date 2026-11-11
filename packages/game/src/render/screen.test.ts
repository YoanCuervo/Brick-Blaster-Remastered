import { describe, expect, it } from "vitest";
import { integerScale, logicalPoint } from "./screen";

describe("logicalPoint", () => {
  it("removes the offset and the scale, rounding down to the pixel", () => {
    expect(logicalPoint(100, 60, 100, 60, 2)).toEqual({ x: 0, y: 0 });
    expect(logicalPoint(101, 63, 100, 60, 2)).toEqual({ x: 0, y: 1 });
    expect(logicalPoint(99, 59, 100, 60, 2)).toEqual({ x: -1, y: -1 });
  });
});

describe("integerScale", () => {
  it.each([
    [1920, 1080, 2],
    [2560, 1440, 3],
    [3840, 2160, 4],
    [1280, 960, 2],
    [1279, 960, 1],
    [800, 600, 1],
    [320, 240, 1],
  ])("%ix%i → ×%i", (w, h, expected) => {
    expect(integerScale(w, h)).toBe(expected);
  });
});
