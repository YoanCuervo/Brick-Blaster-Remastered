// Sprite animation of moving objects, port of the stepper 0x4066BA.

export interface SpriteAnim {
  /** First frame [+0x0D]. */
  readonly first: number;
  /** Frame shown [+0x3D]. */
  frame: number;
  readonly w: number;
  readonly h: number;
  /** Address step to the next frame: width [+0x05] + [+0x71]. */
  readonly step: number;
  /** [+0x61] */
  readonly frames: number;
  /** Frames left before wrapping [+0x65]. */
  left: number;
  /** Reload of the countdown [+0x69]. */
  readonly delay: number;
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

/** One tick: a step happens when the countdown goes below 0, i.e. every delay + 1 ticks. */
export function stepAnim(a: SpriteAnim): void {
  if (a.frames <= 1) return;
  if (--a.countdown >= 0) return;
  a.countdown = a.delay;
  if (a.left > 1) {
    a.frame += a.step;
    a.left--;
  } else {
    a.frame = a.first;
    a.left = a.frames;
  }
}

/** Paddle explosion when a life is lost (0x40303F, normal paddle 0x6900). */
export const EXPLOSION: AnimSpec = {
  first: 0x1c701,
  w: 0x76,
  h: 0x46,
  step: 0xb180,
  frames: 8,
  delay: 4,
  countdown: 4,
};
export const EXPLOSION_DX = -0x15;
export const EXPLOSION_Y = 0x188;

/** Paddle leaving at the end of a level (0x4031D1, normal paddle). */
export const WARP: AnimSpec = {
  first: 0x891e5,
  w: 0x5c,
  h: 0x2b,
  step: 0x6e00,
  frames: 10,
  delay: 1,
  countdown: 1,
};
export const WARP_DX = -9;
export const WARP_Y = 0x197;

/** The game waits until [+0x65] = 2, then hides the paddle (0x404C38, 0x404CAC). */
export const ANIM_END_LEFT = 2;
