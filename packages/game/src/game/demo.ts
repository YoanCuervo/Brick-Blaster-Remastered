// Demo mode of the original: the paddle follows the ball (analysis, Démo).
import type { Ball } from "./ball";
import { type Paddle, clampPaddleX } from "./paddle";

/** 0x40111A: [0x411004], counted down by each full turn of the main loop (0x401F63). */
export const DEMO_TICKS = 0x320;
/** 0x4013D0 and 0x40182C: menu ticks without a cursor move before the demo starts. */
export const MENU_IDLE_TICKS = 0x258;
/** 0x40290F: the cannons fire once the tick counter [0x406561] is above this. */
export const DEMO_SHOT_DELAY = 0xa;
/** 0x403820: the ball of a new level leaves at once, at this speed. */
export const DEMO_SERVE = { dx: 3, dy: -4 } as const;

export interface Demo {
  /** Main loop turns left, [0x411004]. */
  ticksLeft: number;
  /** [0x406561], raised by every vertical blank (0x40654F). */
  shotClock: number;
}

export function createDemo(): Demo {
  return { ticksLeft: DEMO_TICKS, shotClock: 0 };
}

/** 0x404F64: the paddle is centred on ball 1, whatever its state, then clamped (0x406EB1). */
export function demoPaddleX(paddle: Paddle, ball: Ball): number {
  return clampPaddleX(paddle, ball.x - (paddle.w >> 1));
}

/** 0x40290F: fires and restarts the counter once it is above the delay. */
export function demoShot(demo: Demo): boolean {
  if (demo.shotClock <= DEMO_SHOT_DELAY) return false;
  demo.shotClock = 0;
  return true;
}

/** 0x401F63: true on the turn that ends the demo. */
export function stepDemo(demo: Demo): boolean {
  return --demo.ticksLeft === 0;
}

/**
 * Menu loop 0x4013D5: a cursor move (0x401805) or a press (0x401464) restores the count,
 * every turn takes one off, and the demo starts when it reaches 0 (0x401423).
 */
export class MenuIdle {
  private left = MENU_IDLE_TICKS;
  private x: number | null = null;
  private y: number | null = null;

  /** @returns true on the tick that starts the demo. */
  tick(x: number, y: number, pressed: boolean): boolean {
    if (pressed || x !== this.x || y !== this.y) this.left = MENU_IDLE_TICKS;
    this.x = x;
    this.y = y;
    if (--this.left !== 0) return false;
    this.left = MENU_IDLE_TICKS;
    return true;
  }
}
