import { describe, expect, it } from "vitest";
import { parseFlc } from "../data/flc";
import { countingFlc } from "../data/flc.testdata";
import { IMAGE_NAMES } from "../data/images";
import { FADE_STEPS } from "../render/fade";
import { Film } from "./film";
import { BOOT_SLIDES, CREDITS_LAST_ORDER, CREDITS_SLIDES, Slideshow } from "./slideshow";

const IDLE_TO_HOLD = 1 + FADE_STEPS + FADE_STEPS + 5 + FADE_STEPS;
const run = (s: Slideshow, ticks: number, order: number | null = null) => {
  for (let i = 0; i < ticks; i++) expect(s.tick(false, false, order)).toBe(false);
};
const options = { loop: true, keyExits: true, lastOrder: CREDITS_LAST_ORDER };

describe("slides", () => {
  it("run m, g, c, w, e in the credits and b at the start (directory 0x40A17A)", () => {
    expect(CREDITS_SLIDES.map((s) => s.image)).toEqual(
      [3, 2, 1, 5, 6].map((n) => `credits/credit_${n}`),
    );
    expect(BOOT_SLIDES.map((s) => s.image)).toEqual(["backgrounds/media", "credits/credit_4"]);
  });

  it("only name images of the asset pack", () => {
    for (const s of [...BOOT_SLIDES, ...CREDITS_SLIDES]) {
      expect(IMAGE_NAMES).toContain(s.image);
      if (s.text) expect(IMAGE_NAMES).toContain(s.text);
    }
  });
});

describe("a credits picture (0x401BD5)", () => {
  it("fades out what was there, in 32 ticks, before it shows", () => {
    const s = new Slideshow(CREDITS_SLIDES);
    run(s, 1);
    for (let i = 0; i < FADE_STEPS - 1; i++) {
      s.tick(false, false);
      expect(s.shown).toBeNull();
      expect(s.fade).toBe(i);
    }
    s.tick(false, false);
    expect(s.shown).toBe(CREDITS_SLIDES[0]);
  });

  it("fades in the text, waits 5 ticks, then fades in the rest", () => {
    const s = new Slideshow(CREDITS_SLIDES);
    run(s, 1 + FADE_STEPS);
    expect(s.fade).toBe(FADE_STEPS - 1);
    expect(s.textFade).toBe(FADE_STEPS - 1);
    run(s, FADE_STEPS);
    expect(s.textFade).toBe(0);
    expect(s.fade).toBe(FADE_STEPS - 1);
    run(s, 5);
    expect(s.fade).toBe(FADE_STEPS - 1);
    run(s, FADE_STEPS);
    expect(s.fade).toBe(0);
  });

  it("stays 150 ticks, then moves on with a new fade out", () => {
    const s = new Slideshow(CREDITS_SLIDES);
    run(s, IDLE_TO_HOLD + 150 + 1);
    expect(s.shown).toBe(CREDITS_SLIDES[0]);
    expect(s.fade).toBe(0);
    run(s, FADE_STEPS);
    expect(s.shown).toBe(CREDITS_SLIDES[1]);
  });
});

describe("credits (0x4011FF)", () => {
  it("loop over the pictures", () => {
    const s = new Slideshow(CREDITS_SLIDES, options);
    const seen = [];
    for (let i = 0; i < 6; i++) {
      run(s, IDLE_TO_HOLD);
      seen.push(s.shown);
      run(s, 150);
    }
    expect(seen).toEqual([...CREDITS_SLIDES, CREDITS_SLIDES[0]]);
  });

  it("leave on fire or a key, and a key in a fade counts at its end (0x406F60)", () => {
    const f = new Slideshow(CREDITS_SLIDES, options);
    run(f, IDLE_TO_HOLD);
    expect(f.tick(true, false)).toBe(true);
    const k = new Slideshow(CREDITS_SLIDES, options);
    run(k, 10);
    k.tick(false, true);
    run(k, IDLE_TO_HOLD - 11);
    expect(k.tick(false, false)).toBe(true);
  });

  it("forget a key from before the picture (0x406FC0)", () => {
    const s = new Slideshow(CREDITS_SLIDES, options);
    s.tick(false, true);
    run(s, IDLE_TO_HOLD - 1);
    expect(s.tick(false, false)).toBe(false);
  });

  it("stop after a picture on the last order of the module, not during it (0x401215)", () => {
    const s = new Slideshow(CREDITS_SLIDES, options);
    run(s, IDLE_TO_HOLD + 149, CREDITS_LAST_ORDER);
    expect(s.tick(false, false, CREDITS_LAST_ORDER)).toBe(true);
    const other = new Slideshow(CREDITS_SLIDES, options);
    run(other, IDLE_TO_HOLD + 150, CREDITS_LAST_ORDER - 1);
  });
});

describe("the film of the credits (0x401209)", () => {
  const FRAMES = 2;
  const file = parseFlc(countingFlc(FRAMES), "test.flc");
  const withFilm = { ...options, film: () => new Film(file) };
  /** Release, fade in, then 5 ticks per frame: the last 5 only find the end. */
  const FILM_TICKS = 1 + FADE_STEPS + FRAMES * 5;
  const PASS = IDLE_TO_HOLD + 150;

  it("plays first, without a fade out of its own after the menu's", () => {
    const s = new Slideshow(CREDITS_SLIDES, withFilm);
    expect(s.film).not.toBeNull();
    expect(s.shown).toBeNull();
    run(s, 1 + FADE_STEPS);
    expect(s.film!.shown).toBe(true);
    expect(s.fade).toBe(0);
  });

  it("is not ended by fire or a key, and a key is forgotten after it (0x401BD6)", () => {
    const s = new Slideshow(CREDITS_SLIDES, withFilm);
    s.tick(false, false);
    for (let i = 1; i < FILM_TICKS; i++) expect(s.tick(i < 20, true)).toBe(false);
    run(s, IDLE_TO_HOLD + 149);
    expect(s.shown).toBe(CREDITS_SLIDES[0]);
    expect(s.tick(false, false)).toBe(false);
    expect(s.shown).toBe(CREDITS_SLIDES[0]);
  });

  it("tests the position of the module after it, not during it (0x40120E)", () => {
    const s = new Slideshow(CREDITS_SLIDES, withFilm);
    run(s, FILM_TICKS - 1, CREDITS_LAST_ORDER);
    expect(s.tick(false, false, CREDITS_LAST_ORDER)).toBe(true);
  });

  it("stays on screen while the first picture fades it out", () => {
    const s = new Slideshow(CREDITS_SLIDES, withFilm);
    run(s, FILM_TICKS + 1 + FADE_STEPS - 1);
    expect(s.film).not.toBeNull();
    expect(s.fade).toBe(FADE_STEPS - 2);
    run(s, 1);
    expect(s.film).toBeNull();
    expect(s.shown).toBe(CREDITS_SLIDES[0]);
  });

  it("comes back after the last picture, which it fades out by itself (0x4070C5)", () => {
    const s = new Slideshow(CREDITS_SLIDES, withFilm);
    run(s, FILM_TICKS + PASS * CREDITS_SLIDES.length);
    expect(s.film).toBeNull();
    expect(s.shown).toBe(CREDITS_SLIDES[4]);
    run(s, 1);
    expect(s.fade).toBe(0);
    expect(s.shown).toBe(CREDITS_SLIDES[4]);
    run(s, FADE_STEPS - 1);
    expect(s.film).not.toBeNull();
    expect(s.film!.shown).toBe(false);
    expect(s.shown).toBeNull();
    expect(s.fade).toBe(FADE_STEPS - 1);
    run(s, FILM_TICKS);
    run(s, IDLE_TO_HOLD);
    expect(s.shown).toBe(CREDITS_SLIDES[0]);
  });
});

describe("start of the game (0x401058)", () => {
  it("shows media.gif 200 ticks with a plain fade, and starts the music after it", () => {
    const s = new Slideshow(BOOT_SLIDES);
    let started = 0;
    for (let i = 0; i < 1 + FADE_STEPS + FADE_STEPS; i++) {
      s.tick(false, false);
      if (s.firstFadedIn) started++;
    }
    expect(s.shown).toBe(BOOT_SLIDES[0]);
    expect(s.fade).toBe(0);
    expect(started).toBe(1);
    run(s, 200);
    expect(s.shown).toBe(BOOT_SLIDES[0]);
    run(s, 1 + FADE_STEPS);
    expect(s.shown).toBe(BOOT_SLIDES[1]);
  });

  it("takes a key for the end of the picture only (0x40106C has no jb)", () => {
    const s = new Slideshow(BOOT_SLIDES);
    run(s, 1 + FADE_STEPS + FADE_STEPS);
    expect(s.tick(false, true)).toBe(false);
    run(s, 1 + FADE_STEPS);
    expect(s.shown).toBe(BOOT_SLIDES[1]);
  });

  it("ends after the last picture and starts the music only once", () => {
    const s = new Slideshow(BOOT_SLIDES);
    let started = 0;
    let done = false;
    for (let i = 0; i < 1000 && !done; i++) {
      done = s.tick(false, false);
      if (s.firstFadedIn) started++;
    }
    expect(done).toBe(true);
    expect(started).toBe(1);
  });

  it("waits for fire to be released before a picture", () => {
    const s = new Slideshow(BOOT_SLIDES);
    for (let i = 0; i < 50; i++) s.tick(true, false);
    expect(s.fade).toBe(FADE_STEPS - 1);
    expect(s.shown).toBeNull();
  });
});
