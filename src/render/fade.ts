// Palette fades of 0x406583: 32 palettes, each 6-bit component 2 lower than the last.

export const FADE_STEPS = 0x6000 / 0x300;
/** One step is −2 in 6-bit VGA, −8 once scaled to 8 bits (v << 2). */
export const FADE_STEP_8BIT = 8;

export function fadeChannel(value: number, step: number): number {
  return Math.max(value - FADE_STEP_8BIT * step, 0);
}

/**
 * Saturating subtraction by compositing: inverted, 255 − c + d stops at 255, so inverting back
 * gives max(c − d, 0). Reading the pixels back would push the canvas to software rendering,
 * where every sprite drawn from a GPU canvas costs a full readback (1 to 8 FPS in game).
 */
export function applyFade(ctx: CanvasRenderingContext2D, step: number): void {
  if (step <= 0) return;
  const { width, height } = ctx.canvas;
  const d = FADE_STEP_8BIT * step;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.globalCompositeOperation = "difference";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = `rgb(${d},${d},${d})`;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.globalCompositeOperation = "difference";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
