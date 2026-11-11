/** 0x4084E8: the same place as the scores, one line of final_text every 30 rows. */
export const FINAL_POS = { x: 0x78, y: 0x16 } as const;

/** The text after the last level (0x408765), over the black left by the FLC (0x4070CA). */
export class FinalScreen {
  private released = false;
  private keyPressed = false;

  constructor(readonly lines: readonly string[]) {}

  /**
   * 0x40876F waits for fire to be released and 0x408785 for fire or a key, with no time limit.
   * @returns true once the screen is over
   */
  tick(fire: boolean, keyPressed: boolean): boolean {
    if (!this.released) {
      // 0x40877B forgets the keys pressed so far.
      this.released = !fire;
      return false;
    }
    this.keyPressed ||= keyPressed;
    return fire || this.keyPressed;
  }
}
