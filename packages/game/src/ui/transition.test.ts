import { describe, expect, it } from "vitest";
import { FADE_STEPS } from "../render/fade";
import { Transition, quitVolume } from "./transition";

const run = (t: Transition) => {
  let ticks = 0;
  while (!t.tick(false)) ticks++;
  return ticks;
};

describe("Transition (0x4065EF, 0x401F95, 0x40666A)", () => {
  it("shows the 32 fade steps, one per tick", () => {
    const t = new Transition();
    const steps = [];
    while (!t.tick(false)) steps.push(t.fade);
    expect(steps).toEqual(Array.from({ length: FADE_STEPS }, (_, i) => i));
  });

  it("holds the screen while the music fades", () => {
    expect(run(new Transition({ musicTicks: 33 }))).toBe(33 + FADE_STEPS);
  });

  it("starts the music only once fire is released", () => {
    let started = 0;
    const t = new Transition({ waitRelease: true, onMusic: () => started++ });
    t.tick(true);
    t.tick(true);
    expect(started).toBe(0);
    expect(t.fade).toBe(0);
    t.tick(false);
    t.tick(false);
    expect(started).toBe(1);
  });
});

describe("quitVolume (0x40663C)", () => {
  it("lowers by 2 and stops before going negative", () => {
    expect(quitVolume(32)).toBe(30);
    expect(quitVolume(2)).toBe(0);
    expect(quitVolume(1)).toBe(1);
    expect(quitVolume(0)).toBe(0);
  });
});
