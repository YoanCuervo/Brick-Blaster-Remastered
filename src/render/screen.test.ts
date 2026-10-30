import { describe, expect, it } from "vitest";
import { integerScale } from "./screen";

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
