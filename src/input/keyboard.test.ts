import { describe, expect, it } from "vitest";
import { keyboardDx, keyboardSpeed } from "./keyboard";

describe("keyboard paddle control (0x406BB1)", () => {
  it("moves left or right by the speed", () => {
    expect(keyboardDx(true, false, 6)).toBe(-6);
    expect(keyboardDx(false, true, 6)).toBe(6);
    expect(keyboardDx(false, false, 6)).toBe(0);
  });

  it("left wins when both keys are held", () => {
    expect(keyboardDx(true, true, 6)).toBe(-6);
  });

  it("speed is twice the ball start speed (0x4051DC)", () => {
    expect(keyboardSpeed(3)).toBe(6);
  });
});
