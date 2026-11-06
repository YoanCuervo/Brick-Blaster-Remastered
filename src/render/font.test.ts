import { describe, expect, it } from "vitest";
import { FONT_CHARS, GLYPH_W, LINE_HEIGHT, layoutText } from "./font";

describe("layoutText (0x408654)", () => {
  it("uses the 45-entry character table of 0x41C360", () => {
    expect(FONT_CHARS).toHaveLength(45);
    expect(FONT_CHARS.indexOf("&")).toBe(43);
  });

  it("reads glyph i at (1 + 16 i, 1)", () => {
    const [a, z, zero, amp] = layoutText("az0&", 0, 0);
    expect(a).toMatchObject({ sx: 1, sy: 1 });
    expect(z).toMatchObject({ sx: 1 + 16 * 25 });
    expect(zero).toMatchObject({ sx: 1 + 16 * 26 });
    expect(amp).toMatchObject({ sx: 1 + 16 * 43 });
  });

  it("advances 15 px per character, spaces included", () => {
    const glyphs = layoutText("a b", 100, 50);
    expect(glyphs.map((g) => g.dx)).toEqual([100, 100 + GLYPH_W, 100 + 2 * GLYPH_W]);
    expect(glyphs[1]!.sx).toBe(1 + 16 * 44);
  });

  it("starts a new line 30 px lower at the original x", () => {
    const [, b] = layoutText("a\nb", 10, 20);
    expect(b).toMatchObject({ dx: 10, dy: 20 + LINE_HEIGHT });
  });

  it("has no uppercase glyphs: unknown characters are drawn blank", () => {
    expect(layoutText("A", 0, 0)[0]!.sx).toBe(1 + 16 * 44);
  });
});
