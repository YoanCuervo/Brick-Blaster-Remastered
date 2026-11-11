import { describe, expect, it } from "vitest";
import { parseWav } from "./wav";

function wav(samples: number[], channels = 1, bits = 8): ArrayBuffer {
  const pad = samples.length & 1;
  const bytes = new Uint8Array(44 + samples.length + pad);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => {
    for (let i = 0; i < 4; i++) bytes[at + i] = s.charCodeAt(i);
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length + pad, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, 8363, true);
  view.setUint16(34, bits, true);
  text(36, "data");
  view.setUint32(40, samples.length, true);
  bytes.set(samples, 44);
  return bytes.buffer;
}

describe("parseWav", () => {
  it("returns the samples", () => {
    expect([...parseWav(wav([1, 2, 3]), "a.wav")]).toEqual([1, 2, 3]);
  });

  it("rejects what is not a WAV", () => {
    expect(() => parseWav(new ArrayBuffer(4), "a.wav")).toThrow("a.wav");
    expect(() => parseWav(new Uint8Array(20).buffer, "a.wav")).toThrow("RIFF");
  });

  it("rejects other sample formats", () => {
    expect(() => parseWav(wav([1, 2], 2), "a.wav")).toThrow("8-bit mono");
    expect(() => parseWav(wav([1, 2], 1, 16), "a.wav")).toThrow("8-bit mono");
  });

  it("rejects a file without samples", () => {
    expect(() => parseWav(wav([]).slice(0, 36), "a.wav")).toThrow("data chunk");
  });
});
