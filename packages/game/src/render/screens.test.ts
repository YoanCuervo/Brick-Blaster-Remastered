import { describe, expect, it } from "vitest";
import { filmPosition, indexedToRgba } from "./screens";

describe("a film on screen", () => {
  it("is centred (0x409861)", () => {
    expect(filmPosition(400, 79)).toEqual({ x: 120, y: 200 });
    expect(filmPosition(450, 180)).toEqual({ x: 95, y: 150 });
  });

  it("scales its 6-bit colours like the VGA DAC, and is opaque", () => {
    const palette = new Uint8Array([0, 0, 0, 63, 32, 1]);
    const rgba = new Uint8ClampedArray(8);
    indexedToRgba(new Uint8Array([1, 0]), palette, rgba);
    expect([...rgba]).toEqual([252, 128, 4, 255, 0, 0, 0, 255]);
  });
});
