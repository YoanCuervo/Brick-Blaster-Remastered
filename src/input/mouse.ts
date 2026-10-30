/** The original adds half of the scaled mickeys to the paddle x (0x406EA0). */
export const MOUSE_BASE_FACTOR = 0.5;
/** Matches Mouse_Speed −1, the best setting found on the original. */
export const DEFAULT_SENSITIVITY = 0.5;

/**
 * Collects raw mouse movement between ticks and hands it out as whole pixels.
 * The fractional rest is kept, which gives the continuous sensitivity the
 * original's integer Mouse_Speed (a bit shift) could not.
 */
export class MouseAccumulator {
  private pending = 0;

  constructor(public sensitivity = DEFAULT_SENSITIVITY) {}

  add(movementX: number): void {
    this.pending += movementX * MOUSE_BASE_FACTOR * this.sensitivity;
  }

  /** Whole pixels not yet consumed, for drawing ahead of the next tick. */
  peek(): number {
    return Math.trunc(this.pending);
  }

  /** Called once per tick. */
  take(): number {
    const dx = Math.trunc(this.pending);
    this.pending -= dx;
    return dx;
  }

  reset(): void {
    this.pending = 0;
  }
}

/**
 * Locks the pointer on click and feeds raw movement to `acc`. Raw input
 * (`unadjustedMovement`) skips OS acceleration; browsers without it fall back
 * to a plain lock.
 */
export function bindPointerLock(target: HTMLElement, acc: MouseAccumulator): () => void {
  const locked = () => document.pointerLockElement === target;
  const onClick = () => {
    if (locked()) return;
    target
      .requestPointerLock({ unadjustedMovement: true })
      .catch(() => target.requestPointerLock())
      .catch(() => undefined);
  };
  const onMove = (e: MouseEvent) => {
    if (locked()) acc.add(e.movementX);
  };
  const onLockChange = () => {
    if (!locked()) acc.reset();
  };
  target.addEventListener("click", onClick);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("pointerlockchange", onLockChange);
  return () => {
    target.removeEventListener("click", onClick);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("pointerlockchange", onLockChange);
  };
}
