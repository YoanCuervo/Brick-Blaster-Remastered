import { describe, expect, it } from "vitest";
import { FixedStep, MAX_TICKS_PER_FRAME, TICK_MS } from "./loop";

function makeStep() {
  const calls = { updates: 0, alphas: [] as number[] };
  const step = new FixedStep({
    update: () => calls.updates++,
    render: (alpha) => calls.alphas.push(alpha),
  });
  return { step, calls };
}

describe("FixedStep", () => {
  it("runs 50 ticks per simulated second whatever the frame rate", () => {
    for (const fps of [30, 60, 144, 240]) {
      const { step, calls } = makeStep();
      for (let f = 0; f <= fps; f++) step.frame((f * 1000) / fps);
      expect(calls.updates).toBe(50);
    }
  });

  it("runs no tick on the first frame", () => {
    const { step, calls } = makeStep();
    expect(step.frame(1234)).toBe(0);
    expect(calls.updates).toBe(0);
  });

  it("reports interpolation progress towards the next tick", () => {
    const { step, calls } = makeStep();
    step.frame(0);
    step.frame(TICK_MS * 1.5);
    expect(calls.updates).toBe(1);
    expect(calls.alphas.at(-1)).toBeCloseTo(0.5);
  });

  it("caps catch-up after a long stall and drops the backlog", () => {
    const { step, calls } = makeStep();
    step.frame(0);
    expect(step.frame(10_000)).toBe(MAX_TICKS_PER_FRAME);
    expect(step.frame(10_000 + TICK_MS)).toBe(1);
    expect(calls.updates).toBe(MAX_TICKS_PER_FRAME + 1);
  });
});
