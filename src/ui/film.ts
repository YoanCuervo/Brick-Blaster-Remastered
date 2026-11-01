// An FLC on screen: 0x407078 (intro.flc in the credits) and 0x407143 (blaster.flc at the end).
import { FlcDecoder, type FlcFile } from "../data/flc";
import { FADE_STEPS } from "../render/fade";

/** 0x407121, 0x407203: whatever the duration stored in the file. */
export const FILM_STEP_TICKS = 5;
/** 0x4071FD: blaster.flc ends here, 385 pictures in, on frame 403 of the file. */
export const ENDING_STEPS = 0x180;

const Phase = { Release: 0, FadeIn: 1, Play: 2 } as const;
type Phase = (typeof Phase)[keyof typeof Phase];

/** No input ends it: neither these loops nor 0x40959F test any, and [0x41C877] is never set. */
export class Film {
  readonly decoder: FlcDecoder;
  /** False for the black of 0x4070CA, before the first picture. */
  shown = false;
  /** Fade step of the whole picture, 0 (normal) to FADE_STEPS − 1 (darkest). */
  fade = FADE_STEPS - 1;
  private phase: Phase = Phase.Release;
  private step = 0;

  /** @param steps calls of 0x40959F before the caller stops by itself (0x407217) */
  constructor(
    file: FlcFile,
    private steps = Infinity,
  ) {
    this.decoder = new FlcDecoder(file);
  }

  /**
   * @param fire held
   * @returns true once the film is over, on the tick of its last picture if it has one
   */
  tick(fire: boolean): boolean {
    switch (this.phase) {
      case Phase.Release:
        // 0x4070E9: then the first picture, under the black palette.
        if (fire) return false;
        this.decoder.next();
        this.shown = true;
        this.step = FADE_STEPS;
        this.phase = Phase.FadeIn;
        return false;
      case Phase.FadeIn:
        // 0x406681
        this.fade = --this.step;
        if (this.step > 0) return false;
        this.step = FILM_STEP_TICKS;
        this.phase = Phase.Play;
        return false;
      case Phase.Play:
        if (--this.step > 0) return false;
        this.step = FILM_STEP_TICKS;
        // intro.flc still waits 5 ticks after its last picture, to find the end (0x40957D).
        if (!this.decoder.next()) return true;
        return --this.steps === 0;
    }
  }
}
