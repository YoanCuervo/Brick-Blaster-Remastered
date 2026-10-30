// Palette fades of 0x406583: 32 palettes, each 6-bit component 2 lower than the last.

export const FADE_STEPS = 0x6000 / 0x300;
/** One step is −2 in 6-bit VGA, −8 once scaled to 8 bits (v << 2). */
export const FADE_STEP_8BIT = 8;

export function fadeChannel(value: number, step: number): number {
  return Math.max(value - FADE_STEP_8BIT * step, 0);
}

/** Darkens RGBA pixels in place; alpha is left alone. */
export function fadePixels(data: Uint8ClampedArray, step: number): void {
  if (step <= 0) return;
  const d = FADE_STEP_8BIT * step;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i]! - d;
    data[i + 1] = data[i + 1]! - d;
    data[i + 2] = data[i + 2]! - d;
  }
}

export function applyFade(ctx: CanvasRenderingContext2D, step: number): void {
  if (step <= 0) return;
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  fadePixels(img.data, step);
  ctx.putImageData(img, 0, 0);
}
