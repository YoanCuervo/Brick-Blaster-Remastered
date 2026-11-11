// Not in the original: credits of the music that the browser version adds.

export interface NoticeBlock {
  title: string;
  lines: readonly string[];
}

/** CC BY 4.0 asks for the author, the source and the licence to reach every player. */
export const NOTICE_BLOCKS: readonly NoticeBlock[] = [
  {
    title: "Musiques du monde limbes",
    lines: [
      '"8-bit Castle" de JAM, domaine public',
      '"dog39" de Songerson, CC BY 4.0, modarchive.org/module.php?189675',
      '"Stars (4ch. version)" de cs127, CC BY 4.0, modarchive.org/module.php?201917',
    ],
  },
  { title: "Licence", lines: ["CC BY 4.0 : creativecommons.org/licenses/by/4.0"] },
];

/** Long enough to read it once; a key or fire ends it sooner. */
export const NOTICE_TICKS = 300;

export class Notice {
  private ticks = 0;

  tick(fire: boolean, anyKey: boolean): boolean {
    return fire || anyKey || ++this.ticks >= NOTICE_TICKS;
  }
}
