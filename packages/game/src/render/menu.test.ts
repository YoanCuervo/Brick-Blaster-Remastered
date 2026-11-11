import { describe, expect, it } from "vitest";
import { PULSE_COUNT } from "../ui/menu";
import { limbesMarkShade, pulsePixels } from "./menu";

describe("pulsePixels (0x405671)", () => {
  it("darkens only the palette entries of the quadrant, by 8 per step", () => {
    const first = 0x4c;
    const last = first + PULSE_COUNT - 1;
    const indices = Uint8Array.from([first - 1, first, last, last + 1]);
    const data = new Uint8ClampedArray(16).fill(100);
    pulsePixels(data, indices, first, 3);
    expect(Array.from(data.subarray(0, 4))).toEqual([100, 100, 100, 100]);
    expect(Array.from(data.subarray(4, 8))).toEqual([76, 76, 76, 100]);
    expect(Array.from(data.subarray(8, 12))).toEqual([76, 76, 76, 100]);
    expect(Array.from(data.subarray(12, 16))).toEqual([100, 100, 100, 100]);
  });

  it("stops at black", () => {
    const data = new Uint8ClampedArray(4).fill(10);
    pulsePixels(data, Uint8Array.from([0x7c]), 0x7c, 12);
    expect(data[0]).toBe(0);
  });
});

describe("limbesMarkShade", () => {
  it("draws a ring 5 pixels thick", () => {
    expect(limbesMarkShade(0, 33)).toBeLessThan(1);
    expect(limbesMarkShade(0, 29)).toBeLessThan(1);
    expect(limbesMarkShade(0, 34)).toBe(1);
    expect(limbesMarkShade(28, 0)).toBe(1);
  });

  it("outlines the L and leaves its inside alone, like the S and the A", () => {
    expect(limbesMarkShade(-14, 0)).toBeLessThan(1);
    expect(limbesMarkShade(2, 0)).toBeLessThan(1);
    expect(limbesMarkShade(-6, 0)).toBe(1);
    expect(limbesMarkShade(8, 14)).toBe(1);
    expect(limbesMarkShade(8, 21)).toBeLessThan(1);
    expect(limbesMarkShade(8, -10)).toBe(1);
  });

  it("sits as high in its ring as the other letters", () => {
    expect(limbesMarkShade(-6, -27)).toBeLessThan(1);
    expect(limbesMarkShade(-6, 23)).toBe(1);
  });
});
