// Sprite animation of moving objects, port of the stepper 0x4066BA.

export interface SpriteAnim {
  /** First frame [+0x0D]. */
  first: number;
  /** Frame shown [+0x3D]. */
  frame: number;
  readonly w: number;
  readonly h: number;
  /** Address step to the next frame: width [+0x05] + [+0x71]. */
  step: number;
  /** [+0x61]: at 1 or less the stepper leaves the object on its current frame. */
  frames: number;
  /** Frames left before wrapping [+0x65]. */
  left: number;
  /** Reload of the countdown [+0x69]. */
  delay: number;
  /** [+0x6D] */
  countdown: number;
}

export interface AnimSpec {
  first: number;
  w: number;
  h: number;
  step: number;
  frames: number;
  delay: number;
  countdown: number;
}

/** Objects start with [+0x65] = 1, so the first step only rewinds to the first frame. */
export function createAnim(spec: AnimSpec): SpriteAnim {
  return { ...spec, frame: spec.first, left: 1 };
}

/**
 * One tick: a step happens when the countdown goes below 0, i.e. every delay + 1 ticks.
 * Returns true when a step happened.
 */
export function stepAnim(a: SpriteAnim): boolean {
  if (a.frames <= 1) return false;
  if (--a.countdown >= 0) return false;
  a.countdown = a.delay;
  if (a.left > 1) {
    a.frame += a.step;
    a.left--;
  } else {
    a.frame = a.first;
    a.left = a.frames;
  }
  return true;
}

/** First frames of the three player 1 paddles (0x4025E1, 0x403407, 0x40350F). */
export const PaddleSprite = { Normal: 0x6900, Large: 0x6a28, Small: 0x6afa } as const;

export interface PaddleEffect {
  readonly spec: AnimSpec;
  /** Offset from the paddle's x. */
  readonly dx: number;
}

export const EXPLOSION_Y = 0x188;
export const WARP_Y = 0x197;

function explosion(first: number, w: number, dx: number): PaddleEffect {
  return { spec: { first, w, h: 0x46, step: 0xb180, frames: 8, delay: 4, countdown: 4 }, dx };
}

function warp(first: number, w: number, dx: number): PaddleEffect {
  return { spec: { first, w, h: 0x2b, step: 0x6e00, frames: 10, delay: 1, countdown: 1 }, dx };
}

/** Paddle explosion when a life is lost, by paddle sprite (0x4030DC). */
export function explosionOf(sprite: number): PaddleEffect {
  if (sprite === PaddleSprite.Large) return explosion(0x1c7d5, 0x8f, -0x13);
  if (sprite === PaddleSprite.Small) return explosion(0x1c778, 0x5c, -0x1b);
  return explosion(0x1c701, 0x76, -0x15);
}

/** Paddle leaving at the end of a level, by paddle sprite (0x4032B4). */
export function warpOf(sprite: number): PaddleEffect {
  if (sprite === PaddleSprite.Large) return warp(0xe1c81, 0x7f, -0xb);
  if (sprite === PaddleSprite.Small) return warp(0x8929f, 0x5c, -0x1b);
  return warp(0x891e5, 0x5c, -9);
}

/** Paddle arriving at the start of a round (0x404B88): flag [0x404BFC] selects this strip. */
export const ARRIVAL: PaddleEffect = warp(0x89242, 0x5c, -9);

/** The game waits until [+0x65] = 2, then hides the paddle (0x404C38, 0x404CAC). */
export const ANIM_END_LEFT = 2;
