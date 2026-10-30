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
