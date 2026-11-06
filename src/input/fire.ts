/**
 * Fire button sampled once per tick. The original reads the button state, so a
 * click shorter than a tick could be missed: a press is latched until the next tick.
 */
export class FireLatch {
  private held = 0;
  private pressed = false;

  press(): void {
    this.held++;
    this.pressed = true;
  }

  release(): void {
    this.held = Math.max(this.held - 1, 0);
  }

  clear(): void {
    this.held = 0;
    this.pressed = false;
  }

  /** Called once per tick: held now, or pressed since the last tick. */
  take(): boolean {
    const fire = this.held > 0 || this.pressed;
    this.pressed = false;
    return fire;
  }
}
