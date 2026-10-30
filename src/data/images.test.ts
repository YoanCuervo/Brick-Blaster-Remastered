import { describe, expect, it } from "vitest";
import { IMAGE_NAMES, backgroundImage } from "./images";

describe("backgroundImage (0x407430)", () => {
  it("cycles through the 8 backgrounds of the world", () => {
    expect(backgroundImage("space", 1)).toBe("backgrounds/space_1");
    expect(backgroundImage("space", 8)).toBe("backgrounds/space_8");
    expect(backgroundImage("arcade", 9)).toBe("backgrounds/arcade_1");
    expect(backgroundImage("arcade", 50)).toBe("backgrounds/arcade_2");
  });

  it("is always a loaded image", () => {
    for (let level = 1; level <= 50; level++) {
      expect(IMAGE_NAMES).toContain(backgroundImage("space", level));
      expect(IMAGE_NAMES).toContain(backgroundImage("arcade", level));
    }
  });
});
