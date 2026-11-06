import { describe, expect, it } from "vitest";
import { MouseAccumulator } from "./mouse";

describe("MouseAccumulator", () => {
  it("sensitivity 1 adds half the raw movement, like Mouse_Speed 0", () => {
    const acc = new MouseAccumulator(1);
    acc.add(10);
    expect(acc.take()).toBe(5);
  });

  it("default sensitivity matches Mouse_Speed −1 (a quarter)", () => {
    const acc = new MouseAccumulator();
    acc.add(40);
    expect(acc.take()).toBe(10);
  });

  it("keeps the fractional rest across ticks", () => {
    const acc = new MouseAccumulator(0.3);
    const steps = Array.from({ length: 10 }, () => {
      acc.add(1);
      return acc.take();
    });
    // 10 × 1 × 0.5 × 0.3 = 1.5 px: one whole pixel out, nothing lost.
    expect(steps.reduce((a, b) => a + b, 0)).toBe(1);
    acc.add(10 / 3);
    expect(acc.take()).toBe(1);
  });

  it("handles leftward movement symmetrically", () => {
    const acc = new MouseAccumulator(1);
    acc.add(-3);
    expect(acc.take()).toBe(-1);
    acc.add(-1);
    expect(acc.take()).toBe(-1);
  });

  it("peek does not consume", () => {
    const acc = new MouseAccumulator(1);
    acc.add(8);
    expect(acc.peek()).toBe(4);
    expect(acc.take()).toBe(4);
    expect(acc.peek()).toBe(0);
  });

  it("reset drops pending movement", () => {
    const acc = new MouseAccumulator(1);
    acc.add(9);
    acc.reset();
    expect(acc.take()).toBe(0);
  });
});
