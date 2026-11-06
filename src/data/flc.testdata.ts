// Small synthetic FLC files for the tests: Eclipse assets must stay out of the repo.

type Chunk = readonly [type: number, data: readonly number[]];

const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
const u32 = (v: number) => [...u16(v & 0xffff), ...u16(v >>> 16)];

export const COLOR_CHUNK = 4;
export const SS2_CHUNK = 7;
export const COPY_CHUNK = 16;

export function frameBytes(chunks: readonly Chunk[]): number[] {
  const body = chunks.flatMap(([type, data]) => [...u32(data.length + 6), ...u16(type), ...data]);
  return [
    ...u32(body.length + 16),
    ...u16(0xf1fa),
    ...u16(chunks.length),
    ...Array(8).fill(0),
    ...body,
  ];
}

export function flcBytes(width: number, height: number, frames: readonly number[][]): ArrayBuffer {
  const body = frames.flat();
  const header = new Uint8Array(0x80);
  header.set(u32(0x80 + body.length), 0);
  header.set(u16(0xaf12), 4);
  header.set(u16(frames.length), 6);
  header.set(u16(width), 8);
  header.set(u16(height), 10);
  header.set(u16(8), 12);
  const file = new Uint8Array(0x80 + body.length);
  file.set(header);
  file.set(body, 0x80);
  return file.buffer;
}

/** A file of `drawn` frames with one pixel each, so that every frame can be told from the others. */
export function countingFlc(drawn: number): ArrayBuffer {
  const frames = Array.from({ length: drawn }, (_, i) => frameBytes([[COPY_CHUNK, [i]]]));
  return flcBytes(1, 1, frames);
}
