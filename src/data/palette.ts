import { DataError } from "./validate";

/** 256 RGB triplets of 6-bit VGA DAC values, as in sprite0.pal / sprite1.pal. */
export type VgaPalette = Uint8Array;

export function parsePalette(bytes: ArrayBuffer, path: string): VgaPalette {
  const pal = new Uint8Array(bytes);
  if (pal.length !== 768 || pal.some((v) => v > 63)) {
    throw new DataError(path, "768 bytes of 6-bit values");
  }
  return pal;
}

/** CSS colour of an index, scaled like the GIF palettes (63 -> 252). */
export function paletteColor(pal: VgaPalette, index: number): string {
  const [r, g, b] = [0, 1, 2].map((c) => pal[index * 3 + c]! << 2);
  return `rgb(${r}, ${g}, ${b})`;
}
