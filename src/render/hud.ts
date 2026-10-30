// In-game texts and lives, laid out as the display objects of 0x4057B4..0x405A61.
import { LIFE_ICON_PITCH, type SpriteRef, drawSprite, lifeIcons } from "./atlas";
import type { BitmapFont } from "./font";

export const SCORE_POS = { x: 0x1aa, y: 9 } as const;
export const LEVEL_POS = { x: 0x7b, y: 9 } as const;
export const MESSAGE_POS = { x: 0xc3, y: 0x1be } as const;
/** Right end of the lives strip: x = 0x206 − 12 × lives (0x405BC1). */
export const LIVES_POS = { x: 0x206, y: 0x1ca } as const;

/** Score shown on 6 digits (0x4083A1), level on 2 (0x408483). */
export const scoreText = (score: number) => String(score).padStart(6, "0");
export const levelText = (level: number) => String(level).padStart(2, "0");

export function livesSprite(lives: number): { ref: SpriteRef; x: number; y: number } {
  return {
    ref: lifeIcons(lives),
    x: LIVES_POS.x - LIFE_ICON_PITCH * Math.max(lives, 0),
    y: LIVES_POS.y,
  };
}

export interface HudState {
  score: number;
  level: number;
  lives: number;
  message: string;
}

export function drawHud(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  font: BitmapFont,
  hud: HudState,
): void {
  // The original renders texts into a spare area of the sheet, then blits that area
  // like any sprite, index 0 transparent.
  font.draw(ctx, scoreText(hud.score), SCORE_POS.x, SCORE_POS.y, false);
  font.draw(ctx, levelText(hud.level), LEVEL_POS.x, LEVEL_POS.y, false);
  font.draw(ctx, hud.message, MESSAGE_POS.x, MESSAGE_POS.y, false);
  const lives = livesSprite(hud.lives);
  drawSprite(ctx, sheet, lives.ref, lives.x, lives.y);
}
