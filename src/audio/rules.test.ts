import { describe, expect, it } from "vitest";
import {
  DEFAULT_MUSIC_VOLUME,
  DEFAULT_SOUND_VOLUME,
  MENU_MUSIC,
  MUSIC_CHANNELS,
  SOUND_NAMES,
  SOUND_RATE,
  LIMBES_MUSIC,
  LIMBES_MUSIC_LEVELS,
  WORLD_MUSIC,
  worldMusic,
  holdResample,
  musicFadeTicks,
  musicGain,
  soundGain,
  soundPan,
  soundToPlay,
  voiceGain,
} from "./rules";

describe("sound rules", () => {
  it("lists the 17 sounds of the slot table", () => {
    expect(new Set(SOUND_NAMES).size).toBe(17);
  });

  it("plays at the rate of period 0x10F, not at the 8363 Hz of the headers", () => {
    expect(SOUND_RATE).toBeCloseTo(13208, 0);
  });

  it("keeps only the last sound of a tick, on the single voice", () => {
    expect(soundToPlay([])).toBeNull();
    expect(soundToPlay(["monstoff", "monstoff"])).toBe("monstoff");
    expect(soundToPlay(["boom", "death"])).toBe("death");
  });

  it("starts with the volumes of the user file data", () => {
    expect(DEFAULT_MUSIC_VOLUME).toBe(32);
    expect(DEFAULT_SOUND_VOLUME).toBe(64);
  });

  it("shares the output between the module voices and the 2 sound voices", () => {
    expect(voiceGain(4)).toBe(1 / 3);
    expect(voiceGain(6)).toBe(1 / 4);
    expect(voiceGain(8)).toBe(1 / 5);
  });

  it("stops the volume product at 63/64", () => {
    expect(soundGain("bounce", 4, 64)).toBeCloseTo((63 / 64) * (1 / 3));
  });

  it("plays the 4 half-volume sounds at half level", () => {
    for (const name of ["monstoff", "wall", "pertebal", "boom"] as const) {
      expect(soundGain(name, 4, 64)).toBeCloseTo((32 / 64) * (1 / 3));
    }
  });

  it("follows the sound volume", () => {
    expect(soundGain("bounce", 6, 32)).toBeCloseTo((32 / 64) * (1 / 4));
    expect(soundGain("wall", 6, 32)).toBeCloseTo((16 / 64) * (1 / 4));
    expect(soundGain("bounce", 6, 0)).toBe(0);
  });

  it("pans the sound voice by the voice count of the module", () => {
    expect(soundPan(4)).toBe(-1);
    expect(soundPan(6)).toBe(1);
    expect(soundPan(8)).toBe(-1);
  });
});

describe("music rules", () => {
  it("gives each world its own module, and the menu another", () => {
    expect(WORLD_MUSIC.space).toBe("the_last");
    expect(WORLD_MUSIC.arcade).toBe("hunting_in_lacanau");
    expect(MENU_MUSIC).toBe("love");
  });

  it("keeps one module per world in the original worlds, whatever the level", () => {
    for (const level of [1, 6, 40]) {
      expect(worldMusic("space", level)).toBe("the_last");
      expect(worldMusic("arcade", level)).toBe("hunting_in_lacanau");
    }
  });

  it("changes the module of Limbes every 3 levels, through its 50 levels", () => {
    expect(LIMBES_MUSIC_LEVELS).toBe(3);
    expect(worldMusic("limbes", 1)).toBe("stars_4ch");
    expect(worldMusic("limbes", 3)).toBe("stars_4ch");
    expect(worldMusic("limbes", 4)).toBe("dog39");
    expect(worldMusic("limbes", 7)).toBe("8bit_castle");
    expect(worldMusic("limbes", 10)).toBe("stars_4ch");
    expect(worldMusic("limbes", 13)).toBe("dog39");
    expect(worldMusic("limbes", 50)).toBe("dog39");
    expect(new Set(LIMBES_MUSIC).size).toBe(3);
  });

  it("knows the voice count of each module signature", () => {
    expect(MUSIC_CHANNELS).toEqual({
      love: 6,
      starr: 4,
      the_last: 4,
      hunting_in_lacanau: 6,
      rain_in_the_brain: 8,
      "8bit_castle": 4,
      dog39: 4,
      stars_4ch: 4,
    });
  });

  it("brings the libopenmpt voices to the level of the original", () => {
    expect(musicGain(4, 64)).toBeCloseTo(2 / 3);
    expect(musicGain(6, 64)).toBeCloseTo(3 / 4);
    expect(musicGain(8, 64)).toBeCloseTo(4 / 5);
    expect(musicGain(4, 32)).toBeCloseTo(1 / 3);
  });

  it("fades one volume step per tick, down to -1", () => {
    expect(musicFadeTicks(32)).toBe(33);
    expect(musicFadeTicks(0)).toBe(1);
  });
});

describe("holdResample", () => {
  it("repeats samples without interpolating", () => {
    const out = holdResample(new Uint8Array([128, 192]), 1, 2);
    expect([...out]).toEqual([0, 0, 0.5, 0.5]);
  });

  it("skips samples when the output rate is lower", () => {
    const out = holdResample(new Uint8Array([0, 64, 128, 192]), 2, 1);
    expect([...out]).toEqual([-1, 0]);
  });

  it("keeps the duration at the real rate", () => {
    const out = holdResample(new Uint8Array(13208), SOUND_RATE, 44100);
    expect(out.length / 44100).toBeCloseTo(1, 3);
  });
});
