// Not in the original: credits of the photos and the music that the browser version adds.

export interface NoticeBlock {
  title: string;
  lines: readonly string[];
}

/** Wording fixed by the licences: the credit lines stay as their sources give them. */
export const NOTICE_BLOCKS: readonly NoticeBlock[] = [
  {
    title: "Photos du monde espace (recadrées, réduites et assombries)",
    lines: [
      "Hubble Ultra Deep Field : NASA, ESA, and S. Beckwith (STScI) and the HUDF Team",
      "Saturn : NASA, ESA, STScI, A. Simon (NASA-GSFC)",
      "Whirlpool Galaxy : NASA, ESA, S. Beckwith (STScI), and The Hubble Heritage Team (STScI/AURA)",
      "Mars : NASA, ESA, The Hubble Heritage Team (STScI/AURA), J. Bell (Cornell University) and M. Wolff (Space Science Institute)",
      "Sombrero Galaxy : NASA/ESA and The Hubble Heritage Team (STScI/AURA)",
      "Earth, Apollo 17 : NASA (JSC)",
      "First image of a black hole : EHT Collaboration",
      "Moon, Apollo 11 : NASA (JSC)",
    ],
  },
  {
    title: "Licences",
    lines: [
      "Photos ESA/Hubble et ESO : CC BY 4.0, creativecommons.org/licenses/by/4.0",
      "Ce jeu n'est ni approuvé ni soutenu par la NASA, l'ESA, l'ESO ou l'EHT.",
    ],
  },
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
