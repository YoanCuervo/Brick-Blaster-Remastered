import { describe, expect, it } from "vitest";
import { FixedStep, MAX_TICKS_PER_FRAME, TICK_MS, TICK_RATE } from "./loop";

function makeStep() {
  const calls = { updates: 0, alphas: [] as number[] };
  const step = new FixedStep({
    update: () => calls.updates++,
    render: (alpha) => calls.alphas.push(alpha),
  });
  return { step, calls };
}

describe("FixedStep", () => {
  it("ticks at the 60 Hz of the original's display mode (§4.2)", () => {
    expect(TICK_RATE).toBe(60);
  });

  it("runs 60 ticks per simulated second whatever the frame rate", () => {
    for (const fps of [30, 50, 60, 75, 144, 240]) {
      const { step, calls } = makeStep();
      for (let f = 0; f <= fps; f++) step.frame((f * 1000) / fps);
      expect(calls.updates).toBe(60);
    }
  });

  it("runs exactly one tick per frame on a jittery 60 Hz screen", () => {
    const { step } = makeStep();
    let now = 0;
    step.frame(now);
    for (let f = 0; f < 600; f++) {
      now += TICK_MS + (f % 2 ? 1.2 : -1.2);
      expect(step.frame(now)).toBe(1);
    }
  });

  it("keeps the average rate on a 59 Hz screen", () => {
    const { step, calls } = makeStep();
    let now = 0;
    step.frame(now);
    // 59 Hz: frames late by 0.28 ms each, so one frame now and then runs two ticks.
    for (let f = 0; f < 59 * 10; f++) step.frame((now += 1000 / 59));
    expect(calls.updates).toBeGreaterThanOrEqual(599);
    expect(calls.updates).toBeLessThanOrEqual(600);
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

  it("never reports a negative progress after an early tick", () => {
    const { step, calls } = makeStep();
    step.frame(0);
    step.frame(TICK_MS - 1);
    expect(calls.updates).toBe(1);
    expect(calls.alphas.at(-1)).toBe(0);
  });

  it("caps catch-up after a long stall and drops the backlog", () => {
    const { step, calls } = makeStep();
    step.frame(0);
    expect(step.frame(10_000)).toBe(MAX_TICKS_PER_FRAME);
    expect(step.frame(10_000 + TICK_MS)).toBe(1);
    expect(calls.updates).toBe(MAX_TICKS_PER_FRAME + 1);
  });
});
