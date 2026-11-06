// Full-screen pictures one after the other: start of the game (0x401058) and credits (0x4011FF).
import { creditImage, creditText } from "../data/images";
import { FADE_STEPS } from "../render/fade";
import type { Film } from "./film";

export interface Slide {
  image: string;
  /** Picture of the entries 0xE0..0xFF, faded in before the others (0x401BD5). */
  text: string | null;
  /** Ticks on screen once faded in, unless a key or fire ends it first. */
  hold: number;
}

/** 0x401B98 */
const MEDIA_TICKS = 0xc8;
/** 0x401C27 */
const CREDIT_TICKS = 0x96;
/** 0x401C01, between the two fades. */
const TEXT_PAUSE = 5;

const credit = (n: number): Slide => ({
  image: creditImage(n),
  text: creditText(n),
  hold: CREDIT_TICKS,
});

// Directory of the pack (read at 0x40A17A): c, g, m, b, w, e are the overlay pictures 1 to 6.
const [CODE, GRAPHIC, MUSIC, BLASTER, LIGHT_SHOW, CONTACT] = [1, 2, 3, 4, 5, 6] as const;

/** 0x40106C, 0x401076: music starts with the first picture. */
export const BOOT_SLIDES: readonly Slide[] = [
  { image: "backgrounds/media", text: null, hold: MEDIA_TICKS },
  credit(BLASTER),
];

/** 0x40121E..0x40127E: m, g, c, w, e. The picture b is only for the start of the game. */
export const CREDITS_SLIDES: readonly Slide[] = [
  credit(MUSIC),
  credit(GRAPHIC),
  credit(CODE),
  credit(LIGHT_SHOW),
  credit(CONTACT),
];

/** 0x401215: on the last of the 36 orders of credit.mod, the credits stop by themselves. */
export const CREDITS_LAST_ORDER = 0x23;

export interface SlideshowOptions {
  /** Credits: after the last picture, back to the first (0x401296). */
  loop?: boolean;
  /** Credits: a key or fire leaves the slideshow (0x401228). At the start, only the picture. */
  keyExits?: boolean;
  /** Song position that ends the slideshow, tested after each picture. */
  lastOrder?: number;
  /** Credits: played before the pictures, on each turn of the loop (0x401209). */
  film?: () => Film;
}

const Phase = {
  Release: 0,
  FadeOut: 1,
  FadeText: 2,
  Pause: 3,
  FadeImage: 4,
  Hold: 5,
  Film: 6,
} as const;
type Phase = (typeof Phase)[keyof typeof Phase];

export class Slideshow {
  /** The picture on screen, null for the black before the first one. */
  shown: Slide | null = null;
  /** The film on screen, until the next picture has faded it out. */
  film: Film | null = null;
  /** Fade step of the whole picture, 0 (normal) to FADE_STEPS − 1 (darkest). */
  fade = FADE_STEPS - 1;
  /** Fade step of the text of the picture. */
  textFade = FADE_STEPS - 1;
  /** Set for the tick the first picture is faded in: service 0x34 starts the loaded module. */
  firstFadedIn = false;
  private index = 0;
  private phase: Phase = Phase.Release;
  private step = 0;
  private hold = 0;
  private keyPressed = false;
  private started = false;
  private filmDue = false;

  constructor(
    private readonly slides: readonly Slide[],
    private readonly options: SlideshowOptions = {},
  ) {
    // The screen before the first turn has already faded out (0x4065EF, in Transition).
    if (options.film) this.startFilm();
  }

  /** The text is ahead of the picture: fading in alone, or in full over the fading rest. */
  get textAhead(): boolean {
    return (
      this.shown?.text != null &&
      (this.phase === Phase.FadeText ||
        this.phase === Phase.Pause ||
        this.phase === Phase.FadeImage)
    );
  }

  private get slide(): Slide {
    return this.slides[this.index]!;
  }

  /**
   * @param fire held
   * @param keyPressed any key since the last tick
   * @param order song position of the module, if known
   * @returns true once the slideshow is over
   */
  tick(fire: boolean, keyPressed: boolean, order: number | null = null): boolean {
    this.firstFadedIn = false;
    this.keyPressed ||= keyPressed;
    switch (this.phase) {
      case Phase.Release:
        // 0x406FC0, for the key that ended the last picture: fire keys count as fire here.
        if (fire) return false;
        this.keyPressed = false;
        this.step = 0;
        this.phase = Phase.FadeOut;
        return false;
      case Phase.FadeOut:
        // 0x40768E fades out what is there before it loads the picture.
        this.fade = this.step++;
        if (this.step < FADE_STEPS) return false;
        if (this.filmDue) this.startFilm();
        else this.show();
        return false;
      case Phase.FadeText:
        this.textFade = --this.step;
        if (this.step > 0) return false;
        this.fadedIn();
        this.step = TEXT_PAUSE;
        this.phase = Phase.Pause;
        return false;
      case Phase.Pause:
        if (--this.step > 0) return false;
        this.step = FADE_STEPS;
        this.phase = Phase.FadeImage;
        return false;
      case Phase.FadeImage:
        this.fade = --this.step;
        if (this.step > 0) return false;
        if (this.slide.text === null) this.fadedIn();
        this.hold = this.slide.hold;
        this.phase = Phase.Hold;
        return false;
      case Phase.Hold:
        if (fire || this.keyPressed) return this.next(this.options.keyExits ?? false, order);
        return --this.hold === 0 ? this.next(false, order) : false;
      case Phase.Film: {
        const over = this.film!.tick(fire);
        this.fade = this.film!.fade;
        if (!over) return false;
        // 0x40120E: the same test as after a picture. The next one forgets the keys (0x401BD6).
        if (this.options.lastOrder !== undefined && order === this.options.lastOrder) return true;
        this.phase = Phase.Release;
        return false;
      }
    }
  }

  private startFilm(): void {
    this.film = this.options.film!();
    this.shown = null;
    this.filmDue = false;
    this.fade = FADE_STEPS - 1;
    this.phase = Phase.Film;
  }

  private show(): void {
    this.film = null;
    this.shown = this.slide;
    this.fade = FADE_STEPS - 1;
    this.textFade = FADE_STEPS - 1;
    this.step = FADE_STEPS;
    this.phase = this.slide.text === null ? Phase.FadeImage : Phase.FadeText;
  }

  private fadedIn(): void {
    this.firstFadedIn = !this.started;
    this.started = true;
  }

  private next(exit: boolean, order: number | null): boolean {
    if (exit) return true;
    if (this.options.lastOrder !== undefined && order === this.options.lastOrder) return true;
    if (this.index === this.slides.length - 1) {
      if (!this.options.loop) return true;
      this.index = 0;
      if (this.options.film) {
        // 0x4070C5 fades out by itself, with no wait for a release before it.
        this.filmDue = true;
        this.step = 0;
        this.phase = Phase.FadeOut;
        return false;
      }
    } else {
      this.index++;
    }
    this.phase = Phase.Release;
    return false;
  }
}
