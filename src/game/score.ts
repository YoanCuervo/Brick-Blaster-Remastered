// Score, lives and extra life (§4.5).
import type { Difficulty } from "../data/config";

/** Score cap compared in 0x408454. */
export const MAX_SCORE = 999990;
export const POINTS_PER_UNIT = 10;
/** Score units passed to 0x40841D. */
export const BRICK_UNITS = 1;
export const MONSTER_UNITS = 3;
export const EXTRA_LIFE_UNITS = 8;
/** Spare lives cap (0x405FD5). */
export const MAX_LIVES = 0x13;

export interface Player {
  /** [player + 0x14] */
  score: number;
  /** Spare lives [player + 0x20]: Nbs_Life − 1 at start, game over below 0. */
  lives: number;
  /** Next extra-life threshold [player + 0x24]. */
  nextLife: number;
}

/** 0x401D56 and 0x4083A1. */
export function createPlayer(nbsLife: number, extraLife: number): Player {
  return { score: 0, lives: nbsLife - 1, nextLife: extraLife };
}

/**
 * 0x40841D: medium adds 1 unit and hard 2 (Difficulty is 0/1/2); the "points x2"
 * bonus doubles the total. Points are added 10 at a time up to the cap.
 */
export function addScore(p: Player, units: number, difficulty: Difficulty, doubled = false): void {
  let n = units + difficulty;
  if (doubled) n <<= 1;
  for (; n > 0 && p.score !== MAX_SCORE; n--) p.score += POINTS_PER_UNIT;
}

/** 0x405FB1 */
export function gainLife(p: Player): void {
  p.lives = Math.min(p.lives + 1, MAX_LIVES);
}

/**
 * 0x40600B, once per playing tick: crossing the threshold raises it by Extra_Life,
 * awards 8 units and a life. Returns true when a life was gained.
 */
export function checkExtraLife(
  p: Player,
  extraLife: number,
  difficulty: Difficulty,
  doubled = false,
): boolean {
  if (p.score < p.nextLife) return false;
  p.nextLife += extraLife;
  addScore(p, EXTRA_LIFE_UNITS, difficulty, doubled);
  gainLife(p);
  return true;
}
