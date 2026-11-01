// Flash of the active-bonus icon frame: 0x405671 fades palette entries 112..127 only.
import { CAPSULE_H, type SpriteRef, drawSprite, hudIconSprite } from "./atlas";
import { fadeChannel } from "./fade";

/** Darkens the RGBA pixels whose mask is set, in place. */
export function flashPixels(data: Uint8ClampedArray, mask: Uint8ClampedArray, step: number): void {
  for (let i = 0; i < data.length; i += 4) {
    if (mask[i] === 0) continue;
    data[i] = fadeChannel(data[i]!, step);
    data[i + 1] = fadeChannel(data[i + 1]!, step);
    data[i + 2] = fadeChannel(data[i + 2]!, step);
  }
}

function readRow(source: CanvasImageSource, width: number, y: number): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = CAPSULE_H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, -y);
  return ctx;
}

/** Icon row darkened per palette step, built once per background and step on first use. */
export class IconFlasher {
  private readonly rows = new Map<string, HTMLCanvasElement>();

  constructor(private readonly mask: HTMLImageElement) {}

  draw(
    ctx: CanvasRenderingContext2D,
    sheet: HTMLCanvasElement,
    background: string,
    code: number,
    step: number,
    x: number,
    y: number,
  ): void {
    const ref = hudIconSprite(code);
    if (step <= 0) {
      drawSprite(ctx, sheet, ref, x, y);
      return;
    }
    const rowRef: SpriteRef = { ...ref, y: 0 };
    drawSprite(ctx, this.row(sheet, background, step, ref.y), rowRef, x, y);
  }

  private row(
    sheet: HTMLCanvasElement,
    background: string,
    step: number,
    y: number,
  ): HTMLCanvasElement {
    const key = `${background}/${step}`;
    let row = this.rows.get(key);
    if (!row) {
      const width = sheet.width;
      const out = readRow(sheet, width, y);
      const img = out.getImageData(0, 0, width, CAPSULE_H);
      const mask = readRow(this.mask, width, y).getImageData(0, 0, width, CAPSULE_H);
      flashPixels(img.data, mask.data, step);
      out.putImageData(img, 0, 0);
      row = out.canvas;
      this.rows.set(key, row);
    }
    return row;
  }
}
