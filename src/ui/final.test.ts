import { describe, expect, it } from "vitest";
import { FinalScreen } from "./final";

describe("final screen (0x408710)", () => {
  it("waits for fire to be released, then for a new press", () => {
    const s = new FinalScreen([]);
    expect(s.tick(true, false)).toBe(false);
    expect(s.tick(true, false)).toBe(false);
    expect(s.tick(false, false)).toBe(false);
    for (let i = 0; i < 1000; i++) expect(s.tick(false, false)).toBe(false);
    expect(s.tick(true, false)).toBe(true);
  });

  it("ends on a key too, but not on one from before the release (0x40877B)", () => {
    const s = new FinalScreen([]);
    expect(s.tick(true, true)).toBe(false);
    expect(s.tick(false, true)).toBe(false);
    expect(s.tick(false, false)).toBe(false);
    expect(s.tick(false, true)).toBe(true);
  });
});
