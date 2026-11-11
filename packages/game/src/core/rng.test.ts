import { describe, expect, it } from "vitest";
import { Rng } from "./rng";

describe("Rng", () => {
  it("replays the same sequence for the same seed", () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 100 }, () => a.rand(1000));
    const seqB = Array.from({ length: 100 }, () => b.rand(1000));
    expect(seqA).toEqual(seqB);
  });

  it("differs for different seeds", () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 20 }, () => a.rand(1 << 20));
    const seqB = Array.from({ length: 20 }, () => b.rand(1 << 20));
    expect(seqA).not.toEqual(seqB);
  });

  it("rand(n) includes both bounds and nothing outside", () => {
    const rng = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.rand(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("rand(0) always returns 0", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 10; i++) expect(rng.rand(0)).toBe(0);
  });

  it("rand(n) is uniform (23 = bonus draw range, §5.2)", () => {
    const rng = new Rng(2026);
    const counts = new Array<number>(24).fill(0);
    const draws = 240_000;
    for (let i = 0; i < draws; i++) counts[rng.rand(23)]!++;
    for (const c of counts) expect(Math.abs(c - draws / 24)).toBeLessThan((draws / 24) * 0.05);
  });

  it("rejects invalid ranges", () => {
    expect(() => new Rng(1).rand(-1)).toThrow(RangeError);
    expect(() => new Rng(1).rand(1.5)).toThrow(RangeError);
  });
});
