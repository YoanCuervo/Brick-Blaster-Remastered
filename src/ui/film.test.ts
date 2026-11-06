import { describe, expect, it } from "vitest";
import { parseFlc } from "../data/flc";
import { COPY_CHUNK, countingFlc, flcBytes, frameBytes } from "../data/flc.testdata";
import { FADE_STEPS } from "../render/fade";
import { ENDING_STEPS, FILM_STEP_TICKS, Film } from "./film";

const file = (drawn: number) => parseFlc(countingFlc(drawn), "test.flc");
const toPlaying = 1 + FADE_STEPS;
const run = (f: Film, ticks: number) => {
  for (let i = 0; i < ticks; i++) expect(f.tick(false)).toBe(false);
};

describe("a film (0x407078)", () => {
  it("stays black until fire is released (0x4070E9)", () => {
    const f = new Film(file(3));
    for (let i = 0; i < 50; i++) expect(f.tick(true)).toBe(false);
    expect(f.shown).toBe(false);
    expect(f.fade).toBe(FADE_STEPS - 1);
    f.tick(false);
    expect(f.shown).toBe(true);
  });

  it("fades in the first picture over 32 ticks (0x406681)", () => {
    const f = new Film(file(3));
    run(f, 1);
    expect(f.fade).toBe(FADE_STEPS - 1);
    expect(f.decoder.pixels[0]).toBe(0);
    run(f, FADE_STEPS - 1);
    expect(f.fade).toBe(1);
    run(f, 1);
    expect(f.fade).toBe(0);
    expect(f.decoder.pixels[0]).toBe(0);
  });

  it("shows a picture every 5 ticks, whatever the file says", () => {
    expect(FILM_STEP_TICKS).toBe(5);
    const f = new Film(file(4));
    run(f, toPlaying + 4);
    expect(f.decoder.pixels[0]).toBe(0);
    run(f, 1);
    expect(f.decoder.pixels[0]).toBe(1);
    run(f, 4);
    expect(f.decoder.pixels[0]).toBe(1);
    run(f, 1);
    expect(f.decoder.pixels[0]).toBe(2);
  });

  it("ends 5 ticks after the last picture, played to the end (0x40957D)", () => {
    const f = new Film(file(2));
    run(f, toPlaying + 5);
    expect(f.decoder.pixels[0]).toBe(1);
    run(f, 4);
    expect(f.tick(false)).toBe(true);
  });

  it("spends no tick on empty frames (0x4094D6)", () => {
    const pixel = (v: number) => frameBytes([[COPY_CHUNK, [v]]]);
    const frames = [pixel(0), frameBytes([]), frameBytes([]), pixel(1)];
    const f = new Film(parseFlc(flcBytes(1, 1, frames), "test.flc"));
    run(f, toPlaying + 5);
    expect(f.decoder.pixels[0]).toBe(1);
  });

  it("ignores fire once it plays: nothing interrupts it (0x40959F)", () => {
    const f = new Film(file(2));
    run(f, toPlaying);
    for (let i = 0; i < 9; i++) expect(f.tick(true)).toBe(false);
    expect(f.tick(true)).toBe(true);
  });
});

describe("the end film (0x407143)", () => {
  it("stops after 384 steps, on the tick of its last picture (0x4071FD)", () => {
    expect(ENDING_STEPS).toBe(384);
    const f = new Film(file(ENDING_STEPS + 10), ENDING_STEPS);
    run(f, toPlaying + (ENDING_STEPS - 1) * 5 + 4);
    expect(f.decoder.pixels[0]).toBe((ENDING_STEPS - 1) & 0xff);
    expect(f.tick(false)).toBe(true);
    expect(f.decoder.pixels[0]).toBe(ENDING_STEPS & 0xff);
  });
});
