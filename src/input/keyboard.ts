/**
 * Paddle step for the arrow keys, as the original's player 2 keyboard (0x406BB1):
 * left is tested first, so it wins when both are held.
 */
export function keyboardDx(left: boolean, right: boolean, speed: number): number {
  if (left) return -speed;
  if (right) return speed;
  return 0;
}

/** Keyboard speed is twice the ball start speed (0x4051DC). */
export function keyboardSpeed(ballStartSpeed: number): number {
  return 2 * ballStartSpeed;
}

/** Above the fastest ball, whose |dx| stops below 14 + mode (0x403FAC). */
export const KEY_MAX_SPEED = 16;

/**
 * Not in the original: a held key gains 1 px per tick from the original speed, so a tap still
 * places the paddle finely while a long press keeps up with a fast ball.
 */
export function heldSpeed(baseSpeed: number, heldTicks: number): number {
  return Math.min(baseSpeed + heldTicks, Math.max(baseSpeed, KEY_MAX_SPEED));
}

/** Keyboard paddle control for player 1: one call per tick. */
export class KeyboardPaddle {
  private dir = 0;
  private held = 0;

  constructor(private readonly baseSpeed: number) {}

  step(left: boolean, right: boolean): number {
    const dir = keyboardDx(left, right, 1);
    this.held = dir !== 0 && dir === this.dir ? this.held + 1 : 0;
    this.dir = dir;
    return dir * heldSpeed(this.baseSpeed, this.held);
  }
}

export class KeyState {
  private readonly down = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => this.down.add(e.code));
    target.addEventListener("keyup", (e) => this.down.delete(e.code));
    target.addEventListener("blur", () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }
}
