// Scores, end text and pictures. The palette effects are done by compositing, see fade.ts.
import { FADE_STEPS, applyFade } from "./fade";
import { drawSprite, spriteAt } from "./atlas";
import type { BitmapFont } from "./font";
import { GLYPH_H, GLYPH_W } from "./font";
import { PADDLE_X_MIN, PLAY_RIGHT } from "../game/paddle";
import { drawPlayfield } from "./playfield";
import { FINAL_POS, type FinalScreen } from "../ui/final";
import { NOTICE_BLOCKS } from "../ui/notice";
import { SCORES_POS, TABLE_TITLE_Y, type ScoresScreen } from "../ui/scores";
import type { Slideshow } from "../ui/slideshow";
import type { Images } from "../data/images";
import type { FlcDecoder } from "../data/flc";
import type { Film } from "../ui/film";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "./screen";

export function black(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

const NOTICE_MARGIN = 24;
const NOTICE_LINE = 14;

/** The bitmap font has no accents. */
export function drawNotice(ctx: CanvasRenderingContext2D): void {
  black(ctx);
  ctx.font = "12px monospace";
  ctx.textBaseline = "top";
  const width = ctx.canvas.width - 2 * NOTICE_MARGIN;
  let y = NOTICE_MARGIN;
  const write = (text: string, color: string) => {
    ctx.fillStyle = color;
    let line = "";
    for (const word of text.split(" ")) {
      const longer = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(longer).width > width) {
        ctx.fillText(line, NOTICE_MARGIN, y);
        y += NOTICE_LINE;
        line = word;
      } else {
        line = longer;
      }
    }
    ctx.fillText(line, NOTICE_MARGIN, y);
    y += NOTICE_LINE;
  };
  for (const block of NOTICE_BLOCKS) {
    write(block.title, "#c8a0e0");
    for (const text of block.lines) write(text, "#e0e0e0");
    y += NOTICE_LINE / 2;
  }
}

/** 0x409861: centred on the screen. */
export function filmPosition(width: number, height: number): { x: number; y: number } {
  return { x: (SCREEN_WIDTH - width) >> 1, y: (SCREEN_HEIGHT - height) >> 1 };
}

/** Palette indices to opaque RGBA, 6-bit VGA values scaled like the GIF palettes (63 -> 252). */
export function indexedToRgba(
  pixels: Uint8Array,
  palette: Uint8Array,
  rgba: Uint8ClampedArray,
): void {
  for (let i = 0, o = 0; i < pixels.length; i++) {
    const c = pixels[i]! * 3;
    rgba[o++] = palette[c]! << 2;
    rgba[o++] = palette[c + 1]! << 2;
    rgba[o++] = palette[c + 2]! << 2;
    rgba[o++] = 255;
  }
}

/** Converts a picture once, when it is decoded, and keeps it in its own canvas. */
export class FilmRenderer {
  private canvas = document.createElement("canvas");
  private image: ImageData | null = null;
  private decoder: FlcDecoder | null = null;
  private revision = -1;

  draw(ctx: CanvasRenderingContext2D, film: Film, fade: number): void {
    black(ctx);
    if (film.shown) {
      this.update(film.decoder);
      const { x, y } = filmPosition(this.canvas.width, this.canvas.height);
      ctx.drawImage(this.canvas, x, y);
    }
    applyFade(ctx, fade);
  }

  private update(decoder: FlcDecoder): void {
    if (decoder === this.decoder && decoder.revision === this.revision) return;
    const { width, height } = decoder.file;
    if (this.image?.width !== width || this.image.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.image = new ImageData(width, height);
    }
    indexedToRgba(decoder.pixels, decoder.palette, this.image.data);
    this.canvas.getContext("2d")!.putImageData(this.image, 0, 0);
    this.decoder = decoder;
    this.revision = decoder.revision;
  }
}

/** The panels beside the walls are too narrow for this word on one line. */
const TABLES_HINT = "fleches".split("").join("\n");
const TABLES_HINT_POS = { x: 598, y: 135 } as const;

/** 0x408523: the rows over the bare background, transparent like the text of 0x408654. */
export function drawScores(
  ctx: CanvasRenderingContext2D,
  screen: ScoresScreen,
  background: CanvasImageSource,
  sheet: CanvasImageSource,
  font: BitmapFont,
): void {
  drawPlayfield(ctx, background, sheet);
  font.draw(ctx, screen.rows.join("\n"), SCORES_POS.x, screen.rowsY, false);
  const { title } = screen;
  if (title) {
    const x = (PADDLE_X_MIN + PLAY_RIGHT - title.length * GLYPH_W) >> 1;
    font.draw(ctx, title, x, TABLE_TITLE_Y, false);
  }
  if (screen.switchable) font.draw(ctx, TABLES_HINT, TABLES_HINT_POS.x, TABLES_HINT_POS.y, false);
  const { cursor } = screen;
  if (cursor) {
    drawSprite(ctx, sheet, spriteAt(cursor.address, GLYPH_W, GLYPH_H), cursor.x, cursor.y);
  }
  applyFade(ctx, screen.fade);
}

export function drawFinal(
  ctx: CanvasRenderingContext2D,
  screen: FinalScreen,
  font: BitmapFont,
): void {
  black(ctx);
  font.draw(ctx, screen.lines.join("\n"), FINAL_POS.x, FINAL_POS.y, false);
}

export function drawSlide(
  ctx: CanvasRenderingContext2D,
  show: Slideshow,
  images: Images,
  films: FilmRenderer,
): void {
  if (show.film) return films.draw(ctx, show.film, show.fade);
  const { shown } = show;
  if (!shown) return black(ctx);
  const image = images.get(shown.image)!;
  const text = show.textAhead ? images.get(shown.text!)! : null;
  if (text && show.fade === FADE_STEPS - 1) {
    black(ctx);
    ctx.drawImage(text, 0, 0);
    applyFade(ctx, show.textFade);
    return;
  }
  ctx.drawImage(image, 0, 0);
  applyFade(ctx, show.fade);
  if (text) ctx.drawImage(text, 0, 0);
}
