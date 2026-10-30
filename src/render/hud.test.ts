import { describe, expect, it } from "vitest";
import { levelText, livesSprite, scoreText } from "./hud";

describe("HUD", () => {
  it("pads the score to 6 digits and the level to 2", () => {
    expect(scoreText(0)).toBe("000000");
    expect(scoreText(999990)).toBe("999990");
    expect(levelText(7)).toBe("07");
  });

  it("widens the lives strip to the left, 12 px per life (0x405BC1)", () => {
    expect(livesSprite(0)).toEqual({ ref: { x: 631, y: 0, w: 9, h: 9 }, x: 518, y: 458 });
    expect(livesSprite(2)).toEqual({ ref: { x: 607, y: 0, w: 33, h: 9 }, x: 494, y: 458 });
    expect(livesSprite(-1).x).toBe(518);
  });
});
