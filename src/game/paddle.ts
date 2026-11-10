// Paddle objects, initialised in 0x4025B0 for player 1 and 0x4026E4 for player 2 (§4.4, §4.6).
import { type AnimSpec, PaddleSprite, type SpriteAnim, createAnim } from "./animation";

export const PADDLE_W = 0x4a;
export const PADDLE_H = 0x19;
export const PADDLE_Y = 0x1a0;
/** Left wall of the play area; the right one is 0x210 = 528. */
export const PADDLE_X_MIN = 0x70;
export const PLAY_RIGHT = 0x210;
/** Centred: 0x140 − 0x25. */
export const PADDLE_START_X = 0x140 - 0x25;
/** With two players, 0x40256C moves player 1 right and player 2 left of the centre. */
export const PLAYER1_START_X = 0x140 + 0x50 - 0x25;
export const PLAYER2_START_X = 0x140 - 0x50 - 0x25;

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
  /** Bounds [+0x49] and [+0x51]: the play area, or the other paddle under `collision` (0x402F9D). */
  xMin: number;
  xMax: number;
  /** Frames side by side, the stepper runs in every loop (0x4066BA). */
  anim: SpriteAnim;
}

export function createPaddle(x = PADDLE_START_X): Paddle {
  const p = { x, y: PADDLE_Y, w: 0, xMin: 0, xMax: 0, anim: createAnim(PADDLE_NORMAL) };
  setPaddleSize(p, PADDLE_NORMAL);
  return p;
}

/** Changes the sprite, the width and the bounds; the x stays until the next move clamps it. */
export function setPaddleSize(p: Paddle, spec: AnimSpec): void {
  p.w = spec.w;
  p.anim = createAnim(spec);
  resetPaddleBounds(p);
}

/** The play area, as each size routine writes it (0x4025F7) and 0x402FE7 every tick. */
export function resetPaddleBounds(p: Paddle): void {
  p.xMin = PADDLE_X_MIN;
  p.xMax = PLAY_RIGHT - p.w;
}

export function paddleMaxX(p: Paddle): number {
  return p.xMax;
}

/**
 * Clamp of 0x406EB1, 0x406BEF and 0x40687F: the minimum is tested first, so it wins when the
 * bounds of `collision` cross.
 */
export function clampPaddleX(p: Paddle, x: number): number {
  if (x < p.xMin) return p.xMin;
  return x > p.xMax ? p.xMax : x;
}

export function movePaddle(p: Paddle, dx: number): void {
  p.x = clampPaddleX(p, p.x + dx);
}
