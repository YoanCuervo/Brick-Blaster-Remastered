import { DataError, int, list, record } from "./validate";

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

/** Colours 0..15 a background brings to the screen palette, as 8-bit RGB (0x407430). */
export type BackgroundColors = readonly (readonly [number, number, number])[];
export const BACKGROUND_COLORS = 16;

const rgb = (v: unknown, path: string) =>
  list(v, path, 3, (c, p) => int(c, p, 0, 255)) as unknown as readonly [number, number, number];

/** backgrounds/palettes.json: background image name (without "backgrounds/") -> 16 colours. */
export function parseBackgroundPalettes(json: unknown): Record<string, BackgroundColors> {
  return Object.fromEntries(
    Object.entries(record(json, "palettes.json")).map(([name, colors]) => [
      name,
      list(colors, `palettes.json.${name}`, BACKGROUND_COLORS, rgb),
    ]),
  );
}
