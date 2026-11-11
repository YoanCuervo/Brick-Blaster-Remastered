import { describe, expect, it } from "vitest";
import { FlcDecoder, parseFlc } from "./flc";
import {
  COLOR_CHUNK,
  COPY_CHUNK,
  SS2_CHUNK,
  countingFlc,
  flcBytes,
  frameBytes,
} from "./flc.testdata";

const decoder = (width: number, height: number, frames: number[][]) =>
  new FlcDecoder(parseFlc(flcBytes(width, height, frames), "test.flc"));

describe("parseFlc (0x4097A5)", () => {
  it("reads the size and the frame count of the header", () => {
    const file = parseFlc(flcBytes(4, 2, [frameBytes([])]), "test.flc");
    expect([file.width, file.height, file.frames]).toEqual([4, 2, 1]);
  });

  it("refuses another format, a wrong size or a truncated file", () => {
    const bytes = new Uint8Array(flcBytes(4, 2, [frameBytes([])]));
    const wrongMagic = bytes.slice();
    wrongMagic[4] = 0;
    expect(() => parseFlc(wrongMagic.buffer, "a")).toThrow("magic");
    expect(() => parseFlc(bytes.slice(0, -1).buffer, "b")).toThrow("size");
    expect(() => parseFlc(bytes.slice(0, 10).buffer, "c")).toThrow("header");
  });

  it("refuses a depth other than 8 bits", () => {
    const bytes = new Uint8Array(flcBytes(4, 2, [frameBytes([])]));
    bytes[12] = 16;
    expect(() => parseFlc(bytes.buffer, "a")).toThrow("8 bits");
  });
});

describe("FlcDecoder chunks", () => {
  it("copies a raw frame (0x409759)", () => {
    const d = decoder(2, 2, [frameBytes([[COPY_CHUNK, [1, 2, 3, 4]]])]);
    expect(d.next()).toBe(true);
    expect([...d.pixels]).toEqual([1, 2, 3, 4]);
  });

  it("keeps 6 bits of each colour, after a skip, with 0 meaning 256 (0x4095F3)", () => {
    const skipped = decoder(1, 1, [frameBytes([[COLOR_CHUNK, [1, 0, 2, 1, 0xff, 0x83, 0x07]]])]);
    skipped.next();
    expect([...skipped.palette.subarray(0, 9)]).toEqual([0, 0, 0, 0, 0, 0, 0x3f, 0x20, 1]);

    const all = Array.from({ length: 768 }, () => 0xfc);
    const full = decoder(1, 1, [frameBytes([[COLOR_CHUNK, [1, 0, 0, 0, ...all]]])]);
    full.next();
    expect(full.palette.every((v) => v === 0x3f)).toBe(true);
  });

  it("decodes SS2 copies, fills and pixel skips (0x4096F5)", () => {
    const first = frameBytes([[COPY_CHUNK, Array(12).fill(9)]]);
    // 1 line, 2 packets: skip 1, copy one pair; skip 0, repeat the pair twice.
    const delta = frameBytes([[SS2_CHUNK, [1, 0, 2, 0, 1, 1, 5, 6, 0, 0xfe, 7, 8]]]);
    const d = decoder(6, 2, [first, delta]);
    d.next();
    d.next();
    expect([...d.pixels]).toEqual([9, 5, 6, 7, 8, 7, 8, 9, 9, 9, 9, 9]);
  });

  it("skips lines on every negative word, and restarts each line at its left (0x40970D)", () => {
    const first = frameBytes([[COPY_CHUNK, Array(6).fill(0)]]);
    // 2 lines: skip 1 line, then one pair on row 1; one more on row 2.
    const delta = frameBytes([[SS2_CHUNK, [2, 0, 0xff, 0xff, 1, 0, 0, 1, 3, 4, 1, 0, 0, 1, 5, 6]]]);
    const d = decoder(2, 3, [first, delta]);
    d.next();
    d.next();
    expect([...d.pixels]).toEqual([0, 0, 3, 4, 5, 6]);
  });

  it("stops on a chunk it does not know (0x409537)", () => {
    const d = decoder(1, 1, [frameBytes([[99, []]])]);
    expect(() => d.next()).toThrow("99");
  });
});

describe("FlcDecoder frames (0x40948F)", () => {
  it("plays up to the count of the header, then has nothing new (0x40957D)", () => {
    const d = new FlcDecoder(parseFlc(countingFlc(2), "test.flc"));
    expect(d.next()).toBe(true);
    expect(d.pixels[0]).toBe(0);
    expect(d.next()).toBe(true);
    expect(d.pixels[0]).toBe(1);
    expect(d.next()).toBe(false);
    expect(d.pixels[0]).toBe(1);
  });

  it("goes straight through empty frames, which still use up the count (0x4094D6)", () => {
    const pixel = (v: number) => frameBytes([[COPY_CHUNK, [v]]]);
    const d = decoder(1, 1, [pixel(1), frameBytes([]), frameBytes([]), pixel(2), frameBytes([])]);
    d.next();
    const before = d.revision;
    expect(d.next()).toBe(true);
    expect(d.pixels[0]).toBe(2);
    expect(d.revision).toBe(before + 1);
    expect(d.next()).toBe(false);
  });

  it("never reads the ring frame after the count", () => {
    const bytes = new Uint8Array(countingFlc(2));
    bytes[6] = 1;
    const d = new FlcDecoder(parseFlc(bytes.buffer, "test.flc"));
    expect(d.next()).toBe(true);
    expect(d.next()).toBe(false);
    expect(d.pixels[0]).toBe(0);
  });
});
