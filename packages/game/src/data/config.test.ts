import { describe, expect, it } from "vitest";
import {
  BONUS_KEYS,
  Difficulty,
  FINAL_LINES,
  MENU_COUNT,
  MENU_ITEMS,
  STATUS_KEYS,
  forDifficulty,
  parseConfig,
} from "./config";
import { DataError } from "./validate";

// Shape of tools/extract config.json, with the original default values (§5).
function fixture() {
  const label = ["label", "title"];
  return {
    editorFlag: 0,
    extraLife: 10000,
    mouseSpeed: 0,
    nbsLife: 3,
    startLevel: 1,
    freqChangeSpeed: 1500,
    bonusFreq: Object.fromEntries(BONUS_KEYS.map((k) => [k, [2, 3, 4]])),
    timeBetweenOption: [6, 10, 12],
    freqCreateMonster: [600, 500, 400],
    startSpeed: [2, 3, 4],
    nbsChangeSpeedLevel: [2, 3, 3],
    texts: {
      status: Object.fromEntries(STATUS_KEYS.map((k) => [k, k])),
      bonus: Object.fromEntries(BONUS_KEYS.map((k) => [k, k])),
      menuBegin: label,
      menus: Array.from({ length: MENU_COUNT }, () => Array(MENU_ITEMS).fill(label)),
      menuLast: label,
      final: Array(FINAL_LINES).fill(""),
      finalDual: Array(FINAL_LINES).fill(""),
    },
  };
}

describe("parseConfig", () => {
  it("accepts the extracted shape", () => {
    const cfg = parseConfig(fixture());
    expect(cfg.nbsLife).toBe(3);
    expect(cfg.freqCreateMonster).toEqual([600, 500, 400]);
    expect(Object.keys(cfg.bonusFreq)).toEqual([...BONUS_KEYS]);
    expect(cfg.texts.menus).toHaveLength(7);
  });

  it("follows the cfg bonus order (§5.1)", () => {
    expect(BONUS_KEYS).toHaveLength(24);
    expect(BONUS_KEYS[0]).toBe("3_ball");
    expect(BONUS_KEYS[19]).toBe("ghost");
    expect(BONUS_KEYS[23]).toBe("collision");
  });

  it("rejects a missing bonus", () => {
    const json = fixture();
    delete (json.bonusFreq as Record<string, unknown>).night;
    expect(() => parseConfig(json)).toThrow(DataError);
    expect(() => parseConfig(json)).toThrow("config.bonusFreq.night");
  });

  it("rejects a triplet of the wrong size", () => {
    const json = { ...fixture(), startSpeed: [2, 3] };
    expect(() => parseConfig(json)).toThrow("config.startSpeed");
  });

  it("rejects a non-integer value", () => {
    expect(() => parseConfig({ ...fixture(), extraLife: "10000" })).toThrow("config.extraLife");
  });

  it("rejects a menu with a missing quadrant", () => {
    const json = fixture();
    json.texts.menus[2] = json.texts.menus[2]!.slice(0, 3);
    expect(() => parseConfig(json)).toThrow("config.texts.menus[2]");
  });
});

describe("forDifficulty", () => {
  it("picks easy, medium, hard in order", () => {
    const t = [600, 500, 400] as const;
    expect(forDifficulty(t, Difficulty.Easy)).toBe(600);
    expect(forDifficulty(t, Difficulty.Medium)).toBe(500);
    expect(forDifficulty(t, Difficulty.Hard)).toBe(400);
  });
});
