import { describe, expect, it } from "vitest";
import {
  BLACK_BACKGROUND,
  BLACK_BACKGROUND_COLORS,
  IMAGE_NAMES,
  WORLD_SPRITES,
  backgroundImage,
  worldImage,
} from "./images";

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

  it("stays black through the 50 levels of Limbes, which has no background", () => {
    for (let level = 1; level <= 50; level++) {
      expect(backgroundImage("limbes", level)).toBe(BLACK_BACKGROUND);
    }
    expect(IMAGE_NAMES).not.toContain(BLACK_BACKGROUND);
    expect(IMAGE_NAMES).toContain(BLACK_BACKGROUND_COLORS);
  });
});

describe("worldImage", () => {
  it("gives Limbes the loaded sprites of space", () => {
    for (const sprite of WORLD_SPRITES) {
      expect(worldImage("limbes", sprite)).toBe(worldImage("space", sprite));
      expect(IMAGE_NAMES).toContain(worldImage("limbes", sprite));
    }
  });
});
