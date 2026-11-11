import { FADE_STEPS } from "../render/fade";

/** [0x41B7A4]: quitting also lowers the volume, by this much per fade step (0x40663C). */
const QUIT_VOLUME_STEP = 2;

/** 0x406648 leaves the volume alone once a step would take it below 0. */
export function quitVolume(volume: number): number {
  return volume >= QUIT_VOLUME_STEP ? volume - QUIT_VOLUME_STEP : volume;
}

export interface TransitionOptions {
  /** Esc only goes on once fire is released (0x401F95). */
  waitRelease?: boolean;
  /** A change of module holds the screen until the music has faded (0x40666A). */
  musicTicks?: number;
  /** Called when the wait for the release is over. */
  onMusic?: () => void;
}

/** Leaving a screen: it stays frozen, then the palette fades out over 32 ticks (0x4065EF). */
export class Transition {
  /** Fade step on screen, 0 (normal) to FADE_STEPS − 1 (darkest). */
  fade = 0;
  private waiting: boolean;
  private musicTicks: number;
  private onMusic: (() => void) | undefined;
  private step = 0;

  constructor(options: TransitionOptions = {}) {
    this.waiting = options.waitRelease ?? false;
    this.musicTicks = options.musicTicks ?? 0;
    this.onMusic = options.onMusic;
  }

  /** True once the last fade step has been shown for a tick. */
  tick(fire: boolean): boolean {
    if (this.waiting) {
      if (fire) return false;
      this.waiting = false;
    }
    this.onMusic?.();
    this.onMusic = undefined;
    if (this.musicTicks > 0) {
      this.musicTicks--;
      return false;
    }
    if (this.step === FADE_STEPS) return true;
    this.fade = this.step++;
    return false;
  }
}
