// Best scores: the table of the .scr file, the name entry and the screen, port of 0x408BB9.
import { FADE_STEPS } from "../render/fade";
import { levelText, scoreText } from "../render/hud";
import type { Store } from "./settings";

/** The .scr file holds 2 tables of 15 entries, solo at 0x41C462. Coop is out of scope. */
export const SCORE_ROWS = 0xf;
export const NAME_LENGTH = 0xf;

/** Key of the table, the .scr file of the original. */
export const SCORES_KEY = "brick-blaster.scores";

/** One 32-byte record: the value ranks the entry, the rest is the text the screen shows. */
export interface ScoreEntry {
  value: number;
  /** +4: score and level with their spaces, 12 characters. */
  text: string;
  /** +0x10, padded with spaces. */
  name: string;
}

export const SCORES_POS = { x: 0x78, y: 0x16 } as const;
export const ROW_HEIGHT = 0x1e;
/** 0x408C41: the name column, 12 characters into the row. */
const NAME_X = 0x12c;
const CURSOR_W = 0xf;
/** 0x408DBF, with the other frame 0xF further (0x408DD4). */
const CURSOR_SPRITE = 0x3166;
const CURSOR_TICKS = 0xa;

const BLANK_NAME = " ".repeat(NAME_LENGTH);
const entryText = (score: number, level: number) => `${scoreText(score)}  ${levelText(level)}  `;

/** Table of the exe (0x41C462), kept when the file cannot be read: values below any real score. */
export function defaultScores(): ScoreEntry[] {
  return Array.from({ length: SCORE_ROWS }, (_, i) => ({
    value: i + 1,
    text: entryText(0, 0),
    name: "?".repeat(NAME_LENGTH),
  }));
}

export const scoreRows = (table: readonly ScoreEntry[]) => table.map((e) => e.text + e.name);

/**
 * 0x408C24: the first entry the score reaches gives way, so a tie goes above, and the last entry
 * is lost. Returns the rank, or null below the whole table.
 */
export function insertScore(table: ScoreEntry[], score: number, level: number): number | null {
  const rank = table.findIndex((e) => score >= e.value);
  if (rank < 0) return null;
  table.splice(rank, 0, { value: score, text: entryText(score, level), name: BLANK_NAME });
  table.length = SCORE_ROWS;
  return rank;
}

/** 0x408D3C: printable ASCII, forced to the lowercase of the font by `or al, 0x20`. */
export function nameChar(key: string): string | null {
  if (key.length !== 1) return null;
  const code = key.charCodeAt(0);
  return code >= 0x20 && code < 0x80 ? String.fromCharCode(code | 0x20) : null;
}

const isEntry = (e: unknown): e is ScoreEntry => {
  const { value, text, name } = (e ?? {}) as Partial<ScoreEntry>;
  return (
    Number.isInteger(value) &&
    value! >= 0 &&
    typeof text === "string" &&
    text.length === entryText(0, 0).length &&
    typeof name === "string" &&
    name.length === NAME_LENGTH
  );
};

/** 0x408DDD reads the file at each visit. Anything unusable leaves the table of the exe. */
export function loadScores(store: Store | null): ScoreEntry[] {
  try {
    const saved: unknown = JSON.parse(store?.getItem(SCORES_KEY) ?? "null");
    if (Array.isArray(saved) && saved.length === SCORE_ROWS && saved.every(isEntry)) return saved;
  } catch {
    // Same as no file.
  }
  return defaultScores();
}

export function saveScores(store: Store | null, table: readonly ScoreEntry[]): void {
  try {
    store?.setItem(SCORES_KEY, JSON.stringify(table));
  } catch {
    // Full or blocked storage only costs the table of the next visit.
  }
}

const Phase = { Music: 0, FadeIn: 1, Entry: 2, Wait: 3, Done: 4 } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

/**
 * One visit of 0x408BB9, from the change of music to the end of the screen. The release of fire
 * (0x408C11) and the music that comes back (0x408C1E) belong to the Transition after it.
 */
export class ScoresScreen {
  /** Fade step on screen, 0 (normal) to FADE_STEPS − 1 (darkest). */
  fade = FADE_STEPS - 1;
  /** Row of the name being entered, null on a plain visit. */
  readonly rank: number | null;
  /** Cursor frame on screen, null while there is none. */
  private frame: 0 | 1 | null = null;
  private nextFrame: 0 | 1 = 0;
  private blink = 0;
  private length = 0;
  private phase: Phase;
  private fadeStep = FADE_STEPS;
  private keyPressed = false;

  /**
   * @param table the table, which gets the new entry
   * @param entry the score to insert, null when coming from the menu (0x408AA1)
   * @param musicTicks how long the change of module holds the screen back (0x40666A)
   */
  constructor(
    readonly table: ScoreEntry[],
    entry: { score: number; level: number } | null,
    private musicTicks: number,
  ) {
    this.rank = entry && insertScore(table, entry.score, entry.level);
    this.phase = musicTicks > 0 ? Phase.Music : Phase.FadeIn;
  }

  get rows(): string[] {
    return scoreRows(this.table);
  }

  get editing(): boolean {
    return this.phase === Phase.Entry;
  }

  /** Sprite and position of the cursor, drawn over the name column. */
  get cursor(): { address: number; x: number; y: number } | null {
    if (this.frame === null || this.rank === null || !this.editing) return null;
    return {
      address: CURSOR_SPRITE + this.frame * CURSOR_W,
      x: NAME_X + this.length * CURSOR_W,
      y: SCORES_POS.y + this.rank * ROW_HEIGHT,
    };
  }

  /** A key by its KeyboardEvent.key. 0x408CE5 only opens the keyboard buffer for the entry. */
  key(key: string): void {
    if (!this.editing) return;
    const entry = this.table[this.rank!]!;
    // 0x408D2E, 0x408D32: Esc validates like Enter, an empty name included.
    if (key === "Enter" || key === "Escape") {
      this.phase = Phase.Done;
      return;
    }
    const erase = key === "Backspace";
    const char = erase ? " " : nameChar(key);
    if (char === null || this.length === (erase ? 0 : NAME_LENGTH)) return;
    const at = erase ? this.length - 1 : this.length;
    entry.name = entry.name.slice(0, at) + char + entry.name.slice(at + 1);
    this.length = erase ? at : at + 1;
    // 0x408571 redraws the field, cursor gone until its next change.
    this.frame = null;
  }

  /**
   * @param fire held
   * @param keyPressed any key since the last tick
   * @returns true once the screen is over
   */
  tick(fire: boolean, keyPressed: boolean): boolean {
    // [ebp] keeps the last key through the fade, 0x406F60 then finds it.
    this.keyPressed ||= keyPressed;
    switch (this.phase) {
      case Phase.Music:
        if (--this.musicTicks === 0) this.phase = Phase.FadeIn;
        return false;
      case Phase.FadeIn:
        this.fade = --this.fadeStep;
        if (this.fadeStep === 0) this.phase = this.rank === null ? Phase.Wait : Phase.Entry;
        return false;
      case Phase.Entry:
        // 0x408D82 counts ticks and changes the cursor at the 10th.
        if (++this.blink === CURSOR_TICKS) {
          this.blink = 0;
          this.frame = this.nextFrame;
          this.nextFrame = this.nextFrame === 0 ? 1 : 0;
        }
        return false;
      case Phase.Wait:
        // 0x408D77: fire or a key, with no time limit.
        return fire || this.keyPressed;
      case Phase.Done:
        return true;
    }
  }
}
