import type { BackgroundColors } from "../data/palette";

/** Sheet pixels of index 1..15: byte offset of each in RGBA data, and its index. */
export interface LowPixels {
  readonly offsets: Uint32Array;
  readonly indices: Uint8Array;
}

/** Reads sprites/sprite_sheet_low.png (grey value = index 1..15, 0 elsewhere) as RGBA. */
export function lowPixels(mask: Uint8ClampedArray): LowPixels {
  const offsets: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < mask.length; i += 4) {
    if (mask[i]! > 0) {
      offsets.push(i);
      indices.push(mask[i]!);
    }
  }
  return { offsets: Uint32Array.from(offsets), indices: Uint8Array.from(indices) };
}

/**
 * The screen palette takes entries 0..15 from the background (§3.5, 0x407430), so sprite
 * pixels of those indices show the background's colours. Returns a recoloured copy.
 */
export function recolor(
  sheet: Uint8ClampedArray,
  low: LowPixels,
  colors: BackgroundColors,
): Uint8ClampedArray<ArrayBuffer> {
  const out = sheet.slice();
  for (let i = 0; i < low.offsets.length; i++) {
    const o = low.offsets[i]!;
    const [r, g, b] = colors[low.indices[i]!]!;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
  }
  return out;
}

function pixels(img: HTMLImageElement): Uint8ClampedArray {
  const ctx = canvas(img.width, img.height).getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height).data;
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** World sprite sheets recoloured per background, built once on first use (16 at most). */
export class SheetRecolorer {
  private readonly low: LowPixels;
  private readonly cache = new Map<string, HTMLCanvasElement>();

  constructor(mask: HTMLImageElement) {
    this.low = lowPixels(pixels(mask));
  }

  /** `background` names the cache entry: each background belongs to one world. */
  get(sheet: HTMLImageElement, background: string, colors: BackgroundColors): HTMLCanvasElement {
    let out = this.cache.get(background);
    if (!out) {
      out = canvas(sheet.width, sheet.height);
      const data = recolor(pixels(sheet), this.low, colors);
      out.getContext("2d")!.putImageData(new ImageData(data, sheet.width, sheet.height), 0, 0);
      this.cache.set(background, out);
    }
    return out;
  }
}
