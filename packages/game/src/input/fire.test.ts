import { describe, expect, it } from "vitest";
import { FireLatch } from "./fire";

describe("FireLatch", () => {
  it("reports a click shorter than a tick once", () => {
    const f = new FireLatch();
    f.press();
    f.release();
    expect(f.take()).toBe(true);
    expect(f.take()).toBe(false);
  });

  it("stays on while held, from mouse and key together", () => {
    const f = new FireLatch();
    f.press();
    f.press();
    f.release();
    expect(f.take()).toBe(true);
    expect(f.take()).toBe(true);
    f.release();
    expect(f.take()).toBe(false);
    f.press();
    f.clear();
    expect(f.take()).toBe(false);
  });
});
