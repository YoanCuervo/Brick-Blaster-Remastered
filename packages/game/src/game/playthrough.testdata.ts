// Config and levels shared by the tests that play whole games without the asset pack.
import { BONUS_KEYS, type GameConfig, STATUS_KEYS, type Triplet } from "../data/config";
import { LEVEL_COLS, LEVEL_ROWS, type Level } from "../data/levels";

export function shortLevel(bytes: readonly number[]): Level {
  return Array.from({ length: LEVEL_ROWS }, (_, r) =>
    Array.from({ length: LEVEL_COLS }, (_, c) => (r === 8 ? (bytes[c] ?? 0) : 0)),
  );
}

/** One row of every kind of brick (§4.3). */
export const EVERY_BRICK_ROW = [
  0x21, 0x24, 0x27, 0x11, 0x08, 0x18, 0x21, 0x64, 0xa1, 0xe7, 0x51, 0x48, 0x98,
];

export const testConfig: GameConfig = {
  editorFlag: 0,
  extraLife: 10000,
  mouseSpeed: 0,
  nbsLife: 3,
  startLevel: 1,
  freqChangeSpeed: 1500,
  bonusFreq: Object.fromEntries(
    BONUS_KEYS.map((k) => [k, [2, 2, 2] as Triplet]),
  ) as GameConfig["bonusFreq"],
  timeBetweenOption: [6, 10, 12],
  freqCreateMonster: [600, 500, 400],
  startSpeed: [2, 3, 4],
  nbsChangeSpeedLevel: [2, 3, 3],
  texts: {
    status: Object.fromEntries(STATUS_KEYS.map((k) => [k, k])) as GameConfig["texts"]["status"],
    bonus: Object.fromEntries(BONUS_KEYS.map((k) => [k, k])) as GameConfig["texts"]["bonus"],
    menuBegin: ["", ""],
    menus: [],
    menuLast: ["", ""],
    final: [],
    finalDual: [],
  },
};
