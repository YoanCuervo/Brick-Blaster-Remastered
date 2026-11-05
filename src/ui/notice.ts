// Not in the original: credit of the music that the browser version adds.

export interface NoticeBlock {
  title: string;
  lines: readonly string[];
}

export const NOTICE_BLOCKS: readonly NoticeBlock[] = [
  { title: "Musique du monde limbes", lines: ['"8-bit Castle" de JAM, domaine public'] },
];

/** Long enough to read it once; a key or fire ends it sooner. */
export const NOTICE_TICKS = 300;

export class Notice {
  private ticks = 0;

  tick(fire: boolean, anyKey: boolean): boolean {
    return fire || anyKey || ++this.ticks >= NOTICE_TICKS;
  }
}
