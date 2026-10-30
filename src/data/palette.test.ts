import { describe, expect, it } from "vitest";
import { paletteColor, parsePalette } from "./palette";

describe("parsePalette", () => {
  it("accepts 256 triplets of 6-bit values", () => {
    expect(parsePalette(new Uint8Array(768).fill(63).buffer, "p")).toHaveLength(768);
  });

  it("rejects a wrong size or 8-bit values", () => {
    expect(() => parsePalette(new Uint8Array(767).buffer, "p")).toThrow("p");
    expect(() => parsePalette(new Uint8Array(768).fill(64).buffer, "p")).toThrow("p");
  });
});

describe("paletteColor", () => {
  it("scales 6-bit DAC values by 4 like the GIF palettes", () => {
    const pal = new Uint8Array(768);
    pal.set([10, 0, 10], 0);
    pal.set([63, 31, 0], 3);
    expect(paletteColor(pal, 0)).toBe("rgb(40, 0, 40)");
    expect(paletteColor(pal, 1)).toBe("rgb(252, 124, 0)");
  });
});
