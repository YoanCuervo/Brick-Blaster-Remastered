import { DataError } from "./validate";

const tag = (view: DataView, at: number) =>
  String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + at, 4));

/** The 8-bit unsigned mono samples of a WAV from the asset pack (§6). */
export function parseWav(bytes: ArrayBuffer, path: string): Uint8Array {
  const view = new DataView(bytes);
  if (bytes.byteLength < 12 || tag(view, 0) !== "RIFF" || tag(view, 8) !== "WAVE") {
    throw new DataError(path, "a RIFF WAVE file");
  }
  let format = false;
  for (let pos = 12; pos + 8 <= bytes.byteLength;) {
    const id = tag(view, pos);
    const size = view.getUint32(pos + 4, true);
    if (id === "fmt ") {
      format = view.getUint16(pos + 10, true) === 1 && view.getUint16(pos + 22, true) === 8;
      if (!format) throw new DataError(path, "8-bit mono samples");
    }
    if (id === "data" && format) return new Uint8Array(bytes, pos + 8, size);
    pos += 8 + size + (size & 1);
  }
  throw new DataError(path, "a fmt chunk then a data chunk");
}
