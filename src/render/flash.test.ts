import { describe, expect, it } from "vitest";
import { flashPixels } from "./flash";

describe("flashPixels (0x405671)", () => {
  it("darkens masked pixels only, 8 per step, and keeps alpha", () => {
    const data = new Uint8ClampedArray([100, 20, 0, 255, 100, 20, 0, 255]);
    const mask = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    flashPixels(data, mask, 3);
    expect([...data]).toEqual([76, 0, 0, 255, 100, 20, 0, 255]);
  });
});
