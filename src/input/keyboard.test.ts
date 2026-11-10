import { describe, expect, it } from "vitest";
import {
  KEY_MAX_SPEED,
  KeyboardPaddle,
  fireOwner,
  heldSpeed,
  keyboardDx,
  keyboardSpeed,
} from "./keyboard";

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

describe("keyboard acceleration (remake)", () => {
  it("starts at the original speed and gains 1 px per held tick up to the cap", () => {
    expect(heldSpeed(4, 0)).toBe(4);
    expect(heldSpeed(4, 5)).toBe(9);
    expect(heldSpeed(4, 100)).toBe(KEY_MAX_SPEED);
  });

  it("never goes below the original speed", () => {
    expect(heldSpeed(20, 3)).toBe(20);
  });

  it("speeds up while a key stays down", () => {
    const k = new KeyboardPaddle(4);
    expect([1, 2, 3].map(() => k.step(false, true))).toEqual([4, 5, 6]);
  });

  it("starts over after a release or a change of direction", () => {
    const k = new KeyboardPaddle(4);
    k.step(false, true);
    k.step(false, true);
    expect(k.step(false, false)).toBe(0);
    expect(k.step(false, true)).toBe(4);
    k.step(false, true);
    expect(k.step(true, false)).toBe(-4);
  });

  it("crosses the playfield in well under a second", () => {
    const k = new KeyboardPaddle(4);
    let x = 0;
    let ticks = 0;
    // Playfield x from 112 to 519 (§4.2).
    while (x < 519 - 112) {
      x += k.step(false, true);
      ticks++;
    }
    expect(ticks).toBeLessThan(40);
  });
});

describe("fire keys (remake)", () => {
  it("gives Space, Enter and Ctrl to player 1 without a keyboard partner", () => {
    for (const code of ["Space", "Enter", "ControlLeft", "ControlRight"]) {
      expect(fireOwner(code, false)).toBe(1);
    }
  });

  it("gives Space to player 2 in a coop game at the keyboard, Ctrl and Enter to player 1", () => {
    expect(fireOwner("Space", true)).toBe(2);
    expect(fireOwner("ControlLeft", true)).toBe(1);
    expect(fireOwner("ControlRight", true)).toBe(1);
    expect(fireOwner("Enter", true)).toBe(1);
  });

  it("ignores any other key", () => {
    expect(fireOwner("KeyA", true)).toBeNull();
    expect(fireOwner("ArrowLeft", false)).toBeNull();
  });
});
