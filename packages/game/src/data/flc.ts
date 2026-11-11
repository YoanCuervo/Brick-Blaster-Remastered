// FLC reader of 0x409479. Only the chunks of intro.flc and blaster.flc are ported.
import { DataError } from "./validate";

const FLC_MAGIC = 0xaf12;
const HEADER_SIZE = 0x80;
const FRAME_MAGIC = 0xf1fa;
const FRAME_HEADER_SIZE = 16;
const CHUNK_HEADER_SIZE = 6;
const COLOR_256 = 4;
const DELTA_SS2 = 7;
const COPY = 16;
const COLORS = 256;
const DEPTH = 8;

export interface FlcFile {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  /** Header count: the ring frame stored after these is never read. */
  readonly frames: number;
  readonly bytes: Uint8Array;
}

/** 0x4097A5: the size in the header must be the size of the file. */
export function parseFlc(buffer: ArrayBuffer, path: string): FlcFile {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < HEADER_SIZE) throw new DataError(path, "an FLC header");
  const view = new DataView(buffer);
  if (view.getUint16(4, true) !== FLC_MAGIC) throw new DataError(path, "the FLC magic number");
  if (view.getUint32(0, true) !== bytes.length) throw new DataError(path, "the size in its header");
  if (view.getUint16(12, true) !== DEPTH) throw new DataError(path, "8 bits per pixel");
  const frames = view.getUint16(6, true);
  const width = view.getUint16(8, true);
  const height = view.getUint16(10, true);
  if (frames === 0 || width === 0 || height === 0) throw new DataError(path, "a non-empty FLC");
  return { path, width, height, frames, bytes };
}

export class FlcDecoder {
  /** Palette indices, width × height. */
  readonly pixels: Uint8Array;
  /** 6-bit VGA values: 0x409625 drops the two low bits of the file. */
  readonly palette = new Uint8Array(COLORS * 3);
  /** Changes each time a frame is decoded. */
  revision = 0;
  private readonly view: DataView;
  private position = HEADER_SIZE;
  private left: number;

  constructor(readonly file: FlcFile) {
    const { bytes, width, height, frames } = file;
    this.pixels = new Uint8Array(width * height);
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.left = frames;
  }

  /**
   * 0x40948F: a frame without chunks costs no time and only uses up the count, so playback goes
   * straight on to the next one (0x4094D6).
   * @returns false once the count is used up (0x40957D), with nothing new to show
   */
  next(): boolean {
    while (this.left > 0) {
      this.left--;
      const frame = this.position;
      this.position += this.view.getUint32(frame, true);
      // 0x4094AA treats any other block like an empty frame.
      if (this.view.getUint16(frame + 4, true) !== FRAME_MAGIC) continue;
      const chunks = this.view.getUint16(frame + 6, true);
      if (chunks === 0) continue;
      let chunk = frame + FRAME_HEADER_SIZE;
      for (let i = 0; i < chunks; i++) chunk = this.decodeChunk(chunk);
      this.revision++;
      return true;
    }
    return false;
  }

  private decodeChunk(chunk: number): number {
    const start = chunk + CHUNK_HEADER_SIZE;
    const type = this.view.getUint16(chunk + 4, true);
    if (type === COLOR_256) this.color256(start);
    else if (type === DELTA_SS2) this.deltaSs2(start);
    else if (type === COPY) this.copy(start);
    // 0x409537 gives up on a chunk it does not know.
    else throw new DataError(this.file.path, `a known FLC chunk, not ${type}`);
    return chunk + this.view.getUint32(chunk, true);
  }

  /** 0x4095F3 */
  private color256(start: number): void {
    const { bytes } = this.file;
    const packets = this.view.getUint16(start, true);
    let source = start + 2;
    let color = 0;
    for (let p = 0; p < packets; p++) {
      color = (color + bytes[source]!) & 0xff;
      const count = bytes[source + 1]! || COLORS;
      source += 2;
      for (let i = 0; i < count * 3; i++) {
        this.palette[color * 3 + i] = bytes[source++]! >> 2;
      }
      color += count;
    }
  }

  /** 0x4096F5 */
  private deltaSs2(start: number): void {
    const { view, pixels } = this;
    const { bytes, width } = this.file;
    const lines = view.getUint16(start, true);
    let source = start + 2;
    let row = 0;
    for (let l = 0; l < lines; l++) {
      // 0x40970D: every negative word skips lines, there is no "last pixel" form.
      let packets = view.getInt16(source, true);
      source += 2;
      while (packets < 0) {
        row -= packets * width;
        packets = view.getInt16(source, true);
        source += 2;
      }
      let target = row;
      for (let p = 0; p < packets; p++) {
        target += bytes[source]!;
        const count = view.getInt8(source + 1);
        source += 2;
        if (count < 0) {
          const [low, high] = [bytes[source]!, bytes[source + 1]!];
          source += 2;
          for (let i = 0; i < -count; i++) {
            pixels[target++] = low;
            pixels[target++] = high;
          }
        } else {
          const size = count * 2;
          pixels.set(bytes.subarray(source, source + size), target);
          source += size;
          target += size;
        }
      }
      row += width;
    }
  }

  /** 0x409759 */
  private copy(start: number): void {
    this.pixels.set(this.file.bytes.subarray(start, start + this.pixels.length));
  }
}
