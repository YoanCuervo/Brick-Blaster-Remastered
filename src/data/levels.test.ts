import { describe, expect, it } from "vitest";
import { LEVEL_COLS, LEVEL_ROWS, parseLevels } from "./levels";

const grid = (cell = 0) =>
  Array.from({ length: LEVEL_ROWS }, () => Array<number>(LEVEL_COLS).fill(cell));

describe("parseLevels", () => {
  it("accepts 13 × 24 grids for lv0, lv1 and lv2", () => {
    const set = parseLevels({ lv0: [grid(0x21), grid()], lv1: [grid()], lv2: [] });
    expect(set.lv0).toHaveLength(2);
    expect(set.lv0[0]![LEVEL_ROWS - 1]![LEVEL_COLS - 1]).toBe(0x21);
    expect(set.lv2).toEqual([]);
  });

  it("rejects a missing level file", () => {
    expect(() => parseLevels({ lv0: [], lv1: [] })).toThrow("levels.lv2");
  });

  it("rejects a grid with a missing row", () => {
    expect(() => parseLevels({ lv0: [grid().slice(1)], lv1: [], lv2: [] })).toThrow(
      "levels.lv0[0]",
    );
  });

  it("rejects a row with a missing column", () => {
    const g = grid();
    g[5] = g[5]!.slice(1);
    expect(() => parseLevels({ lv0: [], lv1: [g], lv2: [] })).toThrow("levels.lv1[0][5]");
  });

  it("rejects a cell outside a byte", () => {
    const g = grid();
    g[0]![0] = 256;
    expect(() => parseLevels({ lv0: [g], lv1: [], lv2: [] })).toThrow("levels.lv0[0][0][0]");
  });
});
