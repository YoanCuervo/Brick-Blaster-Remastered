import { describe, expect, it } from "vitest";
import { FADE_STEPS, fadeChannel } from "./fade";

describe("fades (0x406583)", () => {
  it("has 32 steps, the table being 0x6000 bytes of palettes", () => {
    expect(FADE_STEPS).toBe(32);
  });

  it("lowers each 6-bit component by 2 per step, down to 0", () => {
    expect(fadeChannel(63 << 2, 1)).toBe(61 << 2);
    expect(fadeChannel(63 << 2, 31)).toBe(1 << 2);
    expect(fadeChannel(3 << 2, 2)).toBe(0);
    expect(fadeChannel(200, 0)).toBe(200);
  });
});
