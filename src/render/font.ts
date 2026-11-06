// Bitmap font of fonte.gif, port of 0x408654.

/** Character table at 0x41C360: lowercase only, the space maps to an empty cell. */
export const FONT_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789+-#!?:.& ";
export const GLYPH_W = 15;
export const GLYPH_H = 22;
/** Glyph i sits at (1 + 16 i, 1) in the font image (offsets table 0x41C38E). */
export const GLYPH_PITCH = 16;
/** A carriage return moves down 0x4B00 bytes, i.e. 30 screen rows. */
export const LINE_HEIGHT = 30;

const BLANK = FONT_CHARS.indexOf(" ");

export interface GlyphPlacement {
  sx: number;
  sy: number;
  dx: number;
  dy: number;
}

/**
 * Glyph positions for `text` drawn at (x, y). Each character advances by GLYPH_W;
 * "\n" starts a new line LINE_HEIGHT below. A character missing from the table makes
 * the original copy junk from the image corner: it is drawn blank here instead.
 */
export function layoutText(text: string, x: number, y: number): GlyphPlacement[] {
  const out: GlyphPlacement[] = [];
  let dx = x;
  let dy = y;
  for (const ch of text) {
    if (ch === "\n") {
      dx = x;
      dy += LINE_HEIGHT;
      continue;
    }
    const i = FONT_CHARS.indexOf(ch);
    out.push({ sx: 1 + GLYPH_PITCH * (i < 0 ? BLANK : i), sy: 1, dx, dy });
    dx += GLYPH_W;
  }
  return out;
}

export class BitmapFont {
  /**
   * @param image font image with index 0 transparent
   * @param background colour of palette index 0, painted behind glyphs in opaque mode
   */
  constructor(
    private readonly image: CanvasImageSource,
    private readonly background: string,
  ) {}

  /** The original copies glyphs opaque by default and transparent when [0x41C35C] = 1. */
  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, opaque = true): void {
    for (const g of layoutText(text, x, y)) {
      if (opaque) {
        ctx.fillStyle = this.background;
        ctx.fillRect(g.dx, g.dy, GLYPH_W, GLYPH_H);
      }
      ctx.drawImage(this.image, g.sx, g.sy, GLYPH_W, GLYPH_H, g.dx, g.dy, GLYPH_W, GLYPH_H);
    }
  }
}
