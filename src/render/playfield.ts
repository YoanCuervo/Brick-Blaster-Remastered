import { PADDLE_X_MIN, PLAY_RIGHT } from "../game/paddle";
import { WALL_H, WALL_LEFT, WALL_RIGHT, WALL_TILES, WALL_W, drawSprite } from "./atlas";

/** Background with the side walls on it, as loaded by 0x407430 and 0x40575F. */
export function drawPlayfield(
  ctx: CanvasRenderingContext2D,
  background: CanvasImageSource,
  sheet: CanvasImageSource,
): void {
  ctx.drawImage(background, 0, 0);
  for (let i = 0; i < WALL_TILES; i++) {
    drawSprite(ctx, sheet, WALL_LEFT, PADDLE_X_MIN - WALL_W, i * WALL_H);
    drawSprite(ctx, sheet, WALL_RIGHT, PLAY_RIGHT, i * WALL_H);
  }
}
