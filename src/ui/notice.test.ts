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

  it("credits the music of Limbes", () => {
    const text = NOTICE_BLOCKS.flatMap((block) => block.lines).join("\n");
    expect(text).toContain("JAM");
  });
});
