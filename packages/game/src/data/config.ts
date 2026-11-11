import { int, list, record, str } from "./validate";

/** Index into every (easy, medium, hard) triplet of blaster.cfg (§5). */
export const Difficulty = { Easy: 0, Medium: 1, Hard: 2 } as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export type Triplet = readonly [easy: number, medium: number, hard: number];

/** Bonus keys in blaster.cfg order, which is also the bonus table order (§5.1, 0x4125D4). */
export const BONUS_KEYS = [
  "3_ball",
  "6_ball",
  "9_ball",
  "20_ball",
  "death",
  "new_life",
  "shoot",
  "slow_ball",
  "fast_ball",
  "iron_ball",
  "telepod",
  "night",
  "small_ship",
  "large_ship",
  "reverse",
  "next_level",
  "del_monster",
  "magnetic",
  "add_monster",
  "ghost",
  "bonus",
  "malus",
  "mini_shoot",
  "collision",
] as const;
export type BonusKey = (typeof BONUS_KEYS)[number];

export const STATUS_KEYS = [
  "off",
  "ready",
  "over",
  "again",
  "editor",
  "paused",
  "demo",
  "test",
] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export const MENU_COUNT = 7;
export const MENU_ITEMS = 4;
export const FINAL_LINES = 13;

/** [item label, menu title] */
export type MenuText = readonly [label: string, title: string];

export interface GameTexts {
  status: Record<StatusKey, string>;
  bonus: Record<BonusKey, string>;
  menuBegin: MenuText;
  /** 7 menus × 4 quadrants (menu_text_1a … 7d). */
  menus: readonly (readonly MenuText[])[];
  menuLast: MenuText;
  final: readonly string[];
  finalDual: readonly string[];
}

/** Values as written in blaster.cfg (e.g. nbsLife is the real count, not the exe's −1). */
export interface GameConfig {
  editorFlag: number;
  extraLife: number;
  mouseSpeed: number;
  nbsLife: number;
  startLevel: number;
  freqChangeSpeed: number;
  bonusFreq: Record<BonusKey, Triplet>;
  timeBetweenOption: Triplet;
  freqCreateMonster: Triplet;
  startSpeed: Triplet;
  nbsChangeSpeedLevel: Triplet;
  texts: GameTexts;
}

const triplet = (v: unknown, path: string): Triplet =>
  list(v, path, 3, (n, p) => int(n, p)) as unknown as Triplet;

const menuText = (v: unknown, path: string): MenuText =>
  list(v, path, 2, str) as unknown as MenuText;

function keyed<K extends string, T>(
  value: unknown,
  path: string,
  keys: readonly K[],
  item: (v: unknown, path: string) => T,
): Record<K, T> {
  const obj = record(value, path);
  const out = {} as Record<K, T>;
  for (const key of keys) out[key] = item(obj[key], `${path}.${key}`);
  return out;
}

/** Validates the config.json emitted by tools/extract/extract_assets.py. */
export function parseConfig(json: unknown): GameConfig {
  const c = record(json, "config");
  const t = record(c.texts, "config.texts");
  return {
    editorFlag: int(c.editorFlag, "config.editorFlag"),
    extraLife: int(c.extraLife, "config.extraLife"),
    mouseSpeed: int(c.mouseSpeed, "config.mouseSpeed"),
    nbsLife: int(c.nbsLife, "config.nbsLife"),
    startLevel: int(c.startLevel, "config.startLevel"),
    freqChangeSpeed: int(c.freqChangeSpeed, "config.freqChangeSpeed"),
    bonusFreq: keyed(c.bonusFreq, "config.bonusFreq", BONUS_KEYS, triplet),
    timeBetweenOption: triplet(c.timeBetweenOption, "config.timeBetweenOption"),
    freqCreateMonster: triplet(c.freqCreateMonster, "config.freqCreateMonster"),
    startSpeed: triplet(c.startSpeed, "config.startSpeed"),
    nbsChangeSpeedLevel: triplet(c.nbsChangeSpeedLevel, "config.nbsChangeSpeedLevel"),
    texts: {
      status: keyed(t.status, "config.texts.status", STATUS_KEYS, str),
      bonus: keyed(t.bonus, "config.texts.bonus", BONUS_KEYS, str),
      menuBegin: menuText(t.menuBegin, "config.texts.menuBegin"),
      menus: list(t.menus, "config.texts.menus", MENU_COUNT, (m, p) =>
        list(m, p, MENU_ITEMS, menuText),
      ),
      menuLast: menuText(t.menuLast, "config.texts.menuLast"),
      final: list(t.final, "config.texts.final", FINAL_LINES, str),
      finalDual: list(t.finalDual, "config.texts.finalDual", FINAL_LINES, str),
    },
  };
}

export function forDifficulty(values: Triplet, difficulty: Difficulty): number {
  return values[difficulty];
}
