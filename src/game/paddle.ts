// Player 1 paddle object, initialised in 0x4025B0 (§4.2).
import { type AnimSpec, PaddleSprite, type SpriteAnim, createAnim } from "./animation";

export const PADDLE_W = 0x4a;
export const PADDLE_H = 0x19;
export const PADDLE_Y = 0x1a0;
/** Left wall of the play area; the right one is 0x210 = 528. */
export const PADDLE_X_MIN = 0x70;
export const PLAY_RIGHT = 0x210;
/** Centred: 0x140 − 0x25. */
export const PADDLE_START_X = 0x140 - 0x25;

function paddleSpec(first: number, w: number, frames: number, delay: number): AnimSpec {
  return { first, w, h: PADDLE_H, step: w, frames, delay, countdown: delay };
}

/** 0x4025B0 */
export const PADDLE_NORMAL = paddleSpec(PaddleSprite.Normal, PADDLE_W, 4, 5);
/** 0x4033F3 */
export const PADDLE_LARGE = paddleSpec(PaddleSprite.Large, 0x69, 2, 0xa);
/** 0x4034FB */
export const PADDLE_SMALL = paddleSpec(PaddleSprite.Small, 0x26, 2, 8);

export interface Paddle {
  x: number;
  readonly y: number;
  w: number;
  /** Frames side by side, the stepper runs in every loop (0x4066BA). */
  anim: SpriteAnim;
}

export function createPaddle(): Paddle {
  return { x: PADDLE_START_X, y: PADDLE_Y, w: PADDLE_W, anim: createAnim(PADDLE_NORMAL) };
}

/** Changes the sprite and the width, the x stays until the next move clamps it. */
export function setPaddleSize(p: Paddle, spec: AnimSpec): void {
  p.w = spec.w;
  p.anim = createAnim(spec);
}

export function paddleMaxX(p: Paddle): number {
  return PLAY_RIGHT - p.w;
}

/** Moves then clamps to the play area, as 0x406EA3 does. */
export function clampPaddleX(p: Paddle, x: number): number {
  return Math.min(Math.max(x, PADDLE_X_MIN), paddleMaxX(p));
}

export function movePaddle(p: Paddle, dx: number): void {
  p.x = clampPaddleX(p, p.x + dx);
}
