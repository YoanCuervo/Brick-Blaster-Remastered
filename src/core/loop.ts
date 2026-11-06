/**
 * Logic rate of the original game: one tick per vertical blank of the 60 Hz mode it requests
 * (0x40DAF4, 0x40DF87), see analysis §4.2. Its 20 ms timer only drives input and sound.
 */
export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;

/** Caps catch-up after a stall (hidden tab, breakpoint) so the game never fast-forwards. */
export const MAX_TICKS_PER_FRAME = 5;

/**
 * A tick may start this early. On a 60 Hz screen frames last about TICK_MS, give or take some
 * jitter: without slack a frame would now and then run no tick and the next one two. The
 * accumulator then dips below 0, so the average rate stays exactly TICK_RATE.
 */
export const TICK_SLACK_MS = 2;

export interface LoopCallbacks {
  /** Advances the game by exactly one tick. */
  update: () => void;
  /** Draws the current state; `alpha` in [0, 1) is the progress towards the next tick. */
  render: (alpha: number) => void;
}

/**
 * Fixed-step accumulator, independent from requestAnimationFrame so it can be
 * driven by a fake clock in tests.
 */
export class FixedStep {
  private accumulator = 0;
  private last: number | null = null;

  constructor(private readonly callbacks: LoopCallbacks) {}

  /** Feeds a timestamp in ms; returns how many ticks were run. */
  frame(now: number): number {
    if (this.last === null) this.last = now;
    this.accumulator += now - this.last;
    this.last = now;

    let ticks = 0;
    while (this.accumulator >= TICK_MS - TICK_SLACK_MS && ticks < MAX_TICKS_PER_FRAME) {
      this.callbacks.update();
      this.accumulator -= TICK_MS;
      ticks++;
    }
    if (ticks === MAX_TICKS_PER_FRAME) this.accumulator %= TICK_MS;

    this.callbacks.render(Math.max(this.accumulator / TICK_MS, 0));
    return ticks;
  }

  reset(): void {
    this.accumulator = 0;
    this.last = null;
  }
}

/** Runs a FixedStep on requestAnimationFrame. Returns a stop function. */
export function startLoop(callbacks: LoopCallbacks): () => void {
  const step = new FixedStep(callbacks);
  let id = 0;
  const onFrame = (now: number) => {
    step.frame(now);
    id = requestAnimationFrame(onFrame);
  };
  id = requestAnimationFrame(onFrame);
  return () => cancelAnimationFrame(id);
}
