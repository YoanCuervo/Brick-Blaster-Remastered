import { describe, expect, it } from "vitest";
import { NOTICE_BLOCKS, NOTICE_TICKS, Notice } from "./notice";

describe("Notice", () => {
  it("ends by itself", () => {
    const notice = new Notice();
    for (let i = 1; i < NOTICE_TICKS; i++) expect(notice.tick(false, false)).toBe(false);
    expect(notice.tick(false, false)).toBe(true);
  });

  it("ends on a key or on fire", () => {
    expect(new Notice().tick(true, false)).toBe(true);
    expect(new Notice().tick(false, true)).toBe(true);
  });

  it("credits the three modules of Limbes and their licence", () => {
    const text = NOTICE_BLOCKS.flatMap((block) => block.lines).join("\n");
    for (const author of ["JAM", "Songerson", "cs127"]) {
      expect(text).toContain(author);
    }
    expect(text).toContain("creativecommons.org/licenses/by/4.0");
  });
});
