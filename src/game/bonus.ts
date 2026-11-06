// Bonus draw, capsules and active bonus, ported from 0x40531A..0x405E8D (§5.2).
import type { Rng } from "../core/rng";
import {
  BONUS_KEYS,
  type BonusKey,
  type Difficulty,
  type GameConfig,
  forDifficulty,
} from "../data/config";
import { CAPSULE_H, CAPSULE_W } from "../render/atlas";
import type { Paddle } from "./paddle";

/** Capsule of bonus 0 (0x40528A); the code of a bonus is its sprite address. */
const FIRST_CODE = 0x75801;

export interface BonusDef {
  readonly key: BonusKey;
  /** [+0x10]: sprite address, also the id stored as active bonus. */
  readonly code: number;
  /** [+0x00]: `collision` is only enabled in duel (0x4052FC), so one player never gets it. */
  readonly enabled: boolean;
}

/** Table 0x4125D4, in cfg order. +100 and −100 use each other's sprite column. */
export const BONUSES: readonly BonusDef[] = BONUS_KEYS.map((key, i) => {
  const column = key === "bonus" ? i + 1 : key === "malus" ? i - 1 : i;
  return { key, code: FIRST_CODE + CAPSULE_W * column, enabled: key !== "collision" };
});

export function bonusByKey(key: BonusKey): BonusDef {
  return BONUSES.find((b) => b.key === key)!;
}

export interface BonusDraw {
  /** [0x40655D], raised once per tick whatever the mode (0x406549). */
  ticks: number;
  /** [0x411C68] */
  last: number;
}

export function createBonusDraw(): BonusDraw {
  return { ticks: 0, last: 0 };
}

/**
 * 0x40531A, on each destroyed brick. The timer and the last bonus are updated even
 * when the draw ends up dropping nothing.
 */
export function drawBonus(
  draw: BonusDraw,
  config: Pick<GameConfig, "timeBetweenOption" | "bonusFreq">,
  difficulty: Difficulty,
  rng: Rng,
): BonusDef | null {
  if (draw.ticks < forDifficulty(config.timeBetweenOption, difficulty)) return null;
  draw.ticks = 0;
  for (;;) {
    let i: number;
    do i = rng.rand(BONUSES.length - 1);
    while (i === draw.last);
    draw.last = i;
    const bonus = BONUSES[i]!;
    if (!bonus.enabled) return null;
    const freq = forDifficulty(config.bonusFreq[bonus.key], difficulty);
    if (freq === 0) continue;
    if (freq > 1 && rng.rand(freq - 1) !== 0) return null;
    return bonus;
  }
}

/** Capsule slots at 0x412B40, before the first ball object at 0x413048. */
export const MAX_CAPSULES = 8;
export const CAPSULE_DY = 2;
/** Height range where a capsule can be caught (0x405474). */
export const CATCH_Y = 0x1a0;
export const SCREEN_BOTTOM_Y = 0x1e0;

/** [capsule + 1]: −4 is a caught or lost capsule, its slot can be reused. */
export const CapsuleState = { Free: 0, Falling: 1, Gone: -4 } as const;
export type CapsuleState = (typeof CapsuleState)[keyof typeof CapsuleState];

export interface Capsule {
  x: number;
  y: number;
  state: CapsuleState;
  bonus: BonusDef | null;
}

/** 0x405264 */
export function createCapsules(): Capsule[] {
  return Array.from({ length: MAX_CAPSULES }, () => ({
    x: 0,
    y: 0,
    state: CapsuleState.Free,
    bonus: null,
  }));
}

/** 0x4053D4: the first slot not falling. With all of them falling, the bonus is lost. */
export function spawnCapsule(capsules: Capsule[], bonus: BonusDef, x: number, y: number): boolean {
  const slot = capsules.find((c) => c.state !== CapsuleState.Falling);
  if (!slot) return false;
  slot.state = CapsuleState.Falling;
  slot.bonus = bonus;
  slot.x = x;
  slot.y = y;
  return true;
}

/** 0x4054E7: the capsule must fit entirely within the paddle's width. */
export function isCaught(c: Capsule, paddle: Pick<Paddle, "x" | "w">): boolean {
  return c.x >= paddle.x && c.x + CAPSULE_W <= paddle.x + paddle.w;
}

/**
 * 0x405452, also run during the wait loops (0x402072); only mode 3 can catch (0x4054D2).
 * Returns the bonuses caught this tick. A missed capsule goes silently: the sound slot
 * 0x41B9FF is never loaded (probable).
 */
export function updateCapsules(
  capsules: Capsule[],
  paddle: Pick<Paddle, "x" | "w">,
  canCatch: boolean,
): BonusDef[] {
  const caught: BonusDef[] = [];
  for (const c of capsules) {
    if (c.state !== CapsuleState.Falling) continue;
    c.y += CAPSULE_DY;
    if (c.y < CATCH_Y) continue;
    if (canCatch && c.y <= CATCH_Y + CAPSULE_H && isCaught(c, paddle)) {
      c.state = CapsuleState.Gone;
      caught.push(c.bonus!);
    }
    if (c.y + CAPSULE_H + CAPSULE_DY >= SCREEN_BOTTOM_Y) c.state = CapsuleState.Gone;
  }
  return caught;
}

/** Ticks a bonus lasts [0x411CA4], 10 s at 60 Hz (0x4055E5). */
export const BONUS_TICKS = 0x258;
/** The message goes blank, 100 ticks after the catch (0x405E33). */
export const MESSAGE_END_TICKS = 0x1f4;

export interface ActiveBonus {
  /** [0x411C70] */
  active: BonusDef | null;
  /** [0x411C74] */
  previous: BonusDef | null;
  /** [0x411CA4] */
  timer: number;
  /** [0x411CA0]: last label written, not written again while it stays the same. */
  label: BonusKey | null;
  /** Code of the icon in the HUD, null for the blank sprite 0x81381. */
  icon: number | null;
}

export function createActiveBonus(): ActiveBonus {
  return { active: null, previous: null, timer: 0, label: null, icon: null };
}

/** 0x4055AE: a new bonus replaces the active one. */
export function catchBonus(state: ActiveBonus, bonus: BonusDef): void {
  state.previous = state.active;
  state.active = bonus;
  state.timer = BONUS_TICKS;
  state.icon = bonus.code;
}

/** Icon back to blank and label forgotten (0x405E8D). */
function clearIcon(state: ActiveBonus): void {
  state.label = null;
  state.icon = null;
}

export type TimerEvent = "none" | "messageEnd" | "expired";

/**
 * 0x405E1A. The timer keeps running after an instant bonus has cleared the active
 * slot, so its end is also signalled for those.
 */
export function stepBonusTimer(state: ActiveBonus): TimerEvent {
  if (state.timer === 0) return "none";
  state.timer--;
  if (state.timer === MESSAGE_END_TICKS) {
    if (state.active === null) clearIcon(state);
    return "messageEnd";
  }
  if (state.timer !== 0) return "none";
  state.active = null;
  clearIcon(state);
  return "expired";
}

/** Palette steps the icon frame goes down to, one per tick (0x4056D0). */
export const FLASH_DEPTH = 0x2400 / 0x300;
/** Down-and-up cycles of one flash (0x405727). */
export const FLASH_CYCLES = 0xa;

/** State of 0x405671. Only the catch and the end of a flash change `on`. */
export interface IconFlash {
  /** [0x411C8C] */
  on: boolean;
  /** Next palette step: [0x411C7C] / 0x300. */
  step: number;
  /** [0x411C88]: starts going darker. */
  darker: boolean;
  /** [0x411C84]: not reset by a catch, so a catch during a flash does not restart it. */
  cycles: number;
  /** Palette step now on screen for colours 112..127. */
  shown: number;
}

export function createIconFlash(): IconFlash {
  return { on: false, step: 0, darker: true, cycles: 0, shown: 0 };
}

/** One tick of 0x405671. The last step shown is 1: the frame stays slightly dark. */
export function stepIconFlash(f: IconFlash): void {
  if (!f.on) return;
  f.shown = f.step;
  if (f.darker) {
    if (++f.step === FLASH_DEPTH) f.darker = false;
    return;
  }
  if (--f.step !== 0) return;
  f.darker = true;
  if (++f.cycles < FLASH_CYCLES) return;
  f.cycles = 0;
  f.on = false;
}

/** Balls added by the instant bonuses (0x405EBA..0x405F35, 0x40645F in one-player mode). */
export const EXTRA_BALLS: Partial<Record<BonusKey, number>> = {
  "3_ball": 1,
  "6_ball": 3,
  "9_ball": 6,
  "20_ball": 20,
  ghost: 20,
};

/** Score units of a caught capsule (0x40565D) and of the two score bonuses. */
export const CAPSULE_UNITS = 2;
export const BONUS_UNITS = 8;
export const MALUS_UNITS = 0xc;
