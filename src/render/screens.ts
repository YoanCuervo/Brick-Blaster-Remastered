// Scores, end text and pictures. The palette effects are done by compositing, see fade.ts.
import { FADE_STEPS, applyFade } from "./fade";
import { drawSprite, spriteAt } from "./atlas";
import type { BitmapFont } from "./font";
import { GLYPH_H, GLYPH_W } from "./font";
import { drawPlayfield } from "./playfield";
import { FINAL_POS, type FinalScreen } from "../ui/final";
import { SCORES_POS, type ScoresScreen } from "../ui/scores";
import type { Slideshow } from "../ui/slideshow";
import type { Images } from "../data/images";

function black(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** 0x408523: the rows over the bare background, transparent like the text of 0x408654. */
export function drawScores(
  ctx: CanvasRenderingContext2D,
  screen: ScoresScreen,
  background: CanvasImageSource,
  sheet: CanvasImageSource,
  font: BitmapFont,
): void {
  drawPlayfield(ctx, background, sheet);
  font.draw(ctx, screen.rows.join("\n"), SCORES_POS.x, SCORES_POS.y, false);
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

export function drawSlide(ctx: CanvasRenderingContext2D, show: Slideshow, images: Images): void {
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
