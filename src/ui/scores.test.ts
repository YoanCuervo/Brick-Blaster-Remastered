import { describe, expect, it } from "vitest";
import { FADE_STEPS } from "../render/fade";
import {
  NAME_LENGTH,
  ROW_HEIGHT,
  SCORES_KEY,
  SCORES_POS,
  SCORE_ROWS,
  ScoresScreen,
  defaultScores,
  insertScore,
  loadScores,
  nameChar,
  saveScores,
  scoreRows,
} from "./scores";

const fakeStore = (saved: string | null = null) => {
  const values = new Map(saved === null ? [] : [[SCORES_KEY, saved]]);
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => void values.set(k, v),
  };
};

const tableOf = (...values: number[]) =>
  defaultScores().map((e, i) => ({ ...e, value: values[i] ?? 0 }));

describe("score table (0x408C24)", () => {
  it("starts as the table of the exe (0x41C462)", () => {
    const table = defaultScores();
    expect(table).toHaveLength(15);
    expect(table.map((e) => e.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(scoreRows(table)[0]).toBe("000000  00  ???????????????");
  });

  it("takes the first place it reaches and loses the last entry", () => {
    const table = tableOf(300, 200, 100);
    expect(insertScore(table, 250, 7)).toBe(1);
    expect(table.map((e) => e.value).slice(0, 4)).toEqual([300, 250, 200, 100]);
    expect(table).toHaveLength(SCORE_ROWS);
    expect(table[1]!.text).toBe("000250  07  ");
    expect(table[1]!.name).toBe(" ".repeat(NAME_LENGTH));
  });

  it("puts a tie above the entry (jae, 0x408C57)", () => {
    expect(insertScore(tableOf(300, 200), 200, 1)).toBe(1);
  });

  it("keeps a score out when it reaches nothing", () => {
    const table = Array.from({ length: SCORE_ROWS }, () => ({ ...defaultScores()[0]!, value: 50 }));
    expect(insertScore(table, 40, 1)).toBeNull();
    expect(table.every((e) => e.value === 50)).toBe(true);
  });

  it("makes any real score first on the table of the exe, but never 0", () => {
    expect(insertScore(defaultScores(), 0, 1)).toBeNull();
    expect(insertScore(defaultScores(), 10, 1)).toBe(0);
  });
});

describe("name characters (0x408D3C)", () => {
  it("lowers letters with or 0x20 and keeps digits and the space", () => {
    expect(nameChar("A")).toBe("a");
    expect(nameChar("z")).toBe("z");
    expect(nameChar("7")).toBe("7");
    expect(nameChar(" ")).toBe(" ");
  });

  it("refuses what is not printable ASCII", () => {
    expect(nameChar("é")).toBeNull();
    expect(nameChar("Tab")).toBeNull();
    expect(nameChar("\t")).toBeNull();
  });
});

describe("score storage", () => {
  it("reads back what it saved", () => {
    const store = fakeStore();
    const table = defaultScores();
    insertScore(table, 500, 3);
    saveScores(store, table);
    expect(loadScores(store)).toEqual(table);
  });

  it.each([
    ["nothing saved", null],
    ["broken JSON", "{"],
    ["wrong shape", "[1,2,3]"],
    ["bad entry", JSON.stringify(Array(15).fill({ value: -1, text: "x", name: "y" }))],
  ])("falls back on the table of the exe with %s", (_, saved) => {
    expect(loadScores(fakeStore(saved))).toEqual(defaultScores());
  });

  it("survives a store that throws or is missing", () => {
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadScores(throwing)).toEqual(defaultScores());
    expect(loadScores(null)).toEqual(defaultScores());
    expect(() => saveScores(throwing, defaultScores())).not.toThrow();
  });
});

const fadeIn = (s: ScoresScreen) => {
  for (let i = 0; i < FADE_STEPS; i++) expect(s.tick(false, false)).toBe(false);
};
const typing = () => {
  const s = new ScoresScreen(defaultScores(), { score: 500, level: 3 }, 0);
  fadeIn(s);
  return s;
};

describe("scores screen (0x408BB9)", () => {
  it("waits for the music, then fades in over 32 ticks", () => {
    const s = new ScoresScreen(defaultScores(), null, 3);
    for (let i = 0; i < 3; i++) {
      s.tick(false, false);
      expect(s.fade).toBe(FADE_STEPS - 1);
    }
    s.tick(false, false);
    expect(s.fade).toBe(FADE_STEPS - 1);
    for (let i = 0; i < FADE_STEPS - 1; i++) s.tick(false, false);
    expect(s.fade).toBe(0);
  });

  it("stays without limit on a plain visit, until fire or a key (0x408D77)", () => {
    const s = new ScoresScreen(defaultScores(), null, 0);
    fadeIn(s);
    for (let i = 0; i < 1000; i++) expect(s.tick(false, false)).toBe(false);
    expect(s.tick(true, false)).toBe(true);
    const k = new ScoresScreen(defaultScores(), null, 0);
    fadeIn(k);
    expect(k.tick(false, true)).toBe(true);
  });

  it("keeps a key pressed during the fade for the wait ([ebp], 0x406F60)", () => {
    const s = new ScoresScreen(defaultScores(), null, 0);
    s.tick(false, true);
    for (let i = 1; i < FADE_STEPS; i++) s.tick(false, false);
    expect(s.tick(false, false)).toBe(true);
  });

  it("has no entry when the score stays out of the table", () => {
    const s = new ScoresScreen(defaultScores(), { score: 0, level: 1 }, 0);
    expect(s.rank).toBeNull();
    fadeIn(s);
    expect(s.editing).toBe(false);
  });

  it("types into the row, and only once the fade is over (0x408CE5)", () => {
    const s = new ScoresScreen(defaultScores(), { score: 500, level: 3 }, 0);
    s.key("x");
    fadeIn(s);
    expect(s.editing).toBe(true);
    s.key("A");
    s.key("b");
    expect(s.rows[s.rank!]).toBe("000500  03  ab             ");
  });

  it("does not take fire for a validation", () => {
    const s = typing();
    for (let i = 0; i < 100; i++) expect(s.tick(true, true)).toBe(false);
  });

  it("stops at 15 characters (0x408D46)", () => {
    const s = typing();
    for (let i = 0; i < 20; i++) s.key("a");
    expect(s.table[s.rank!]!.name).toBe("a".repeat(15));
  });

  it("erases with backspace, and not before the start (0x408D53)", () => {
    const s = typing();
    s.key("Backspace");
    s.key("a");
    s.key("b");
    s.key("Backspace");
    expect(s.table[s.rank!]!.name.trimEnd()).toBe("a");
    s.key("c");
    expect(s.table[s.rank!]!.name.trimEnd()).toBe("ac");
  });

  it.each(["Enter", "Escape"])("validates with %s, an empty name included", (key) => {
    const s = typing();
    s.key(key);
    expect(s.table[s.rank!]!.name).toBe(" ".repeat(15));
    expect(s.tick(false, false)).toBe(true);
  });

  it("changes the cursor every 10 ticks, one column past the name (0x408D82)", () => {
    const s = typing();
    expect(s.cursor).toBeNull();
    s.key("a");
    for (let i = 0; i < 9; i++) s.tick(false, false);
    expect(s.cursor).toBeNull();
    s.tick(false, false);
    const y = SCORES_POS.y + s.rank! * ROW_HEIGHT;
    expect(s.cursor).toEqual({ address: 0x3166, x: 300 + 15, y });
    for (let i = 0; i < 10; i++) s.tick(false, false);
    expect(s.cursor).toEqual({ address: 0x3166 + 15, x: 300 + 15, y });
  });

  it("wipes the cursor at each key until its next change (0x408571)", () => {
    const s = typing();
    for (let i = 0; i < 10; i++) s.tick(false, false);
    expect(s.cursor).not.toBeNull();
    s.key("a");
    expect(s.cursor).toBeNull();
  });
});
