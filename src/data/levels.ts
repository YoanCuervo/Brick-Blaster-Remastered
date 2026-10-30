import type { World } from "./images";
import { int, list, record } from "./validate";

// §4: 13 columns × 24 rows, one byte per cell, top row first.
export const LEVEL_COLS = 13;
export const LEVEL_ROWS = 24;

/** level[row][col], raw brick byte (0 = empty). */
export type Level = readonly (readonly number[])[];

export const LEVEL_FILES = ["lv0", "lv1", "lv2"] as const;
export type LevelFile = (typeof LEVEL_FILES)[number];
export type LevelSet = Record<LevelFile, readonly Level[]>;

/** The world digit picks the level resource (0x407BEB): lv2 is never loaded. */
export const WORLD_LEVELS: Record<World, LevelFile> = { space: "lv0", arcade: "lv1" };

function level(value: unknown, path: string): Level {
  return list(value, path, LEVEL_ROWS, (row, p) =>
    list(row, p, LEVEL_COLS, (cell, q) => int(cell, q, 0, 255)),
  );
}

/** Validates the levels.json emitted by tools/extract/extract_assets.py. */
export function parseLevels(json: unknown): LevelSet {
  const obj = record(json, "levels");
  const out = {} as Record<LevelFile, Level[]>;
  for (const file of LEVEL_FILES) {
    out[file] = list(obj[file], `levels.${file}`, undefined, level);
  }
  return out;
}
