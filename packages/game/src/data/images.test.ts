import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FREE_BACKGROUND_COLORS,
  LIMBES_BACKGROUNDS,
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

  it("gives Limbes its own 8 backgrounds, through all its levels", () => {
    expect(backgroundImage("limbes", 1)).toBe("backgrounds/limbes_1");
    expect(backgroundImage("limbes", 8)).toBe("backgrounds/limbes_8");
    expect(backgroundImage("limbes", 50)).toBe("backgrounds/limbes_2");
  });

  it("finds the new backgrounds versioned, and the colours they borrow in the pack", () => {
    for (const name of LIMBES_BACKGROUNDS) {
      expect(existsSync(new URL(`../assets/${name}.png`, import.meta.url)), name).toBe(true);
    }
    expect(IMAGE_NAMES).toContain(FREE_BACKGROUND_COLORS);
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
