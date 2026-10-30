import { describe, expect, it } from "vitest";
import { BRICK_COLOR_STRIDE, BRICK_GHOST, brickSprite, capsuleSprite, spriteAt } from "./atlas";

describe("spriteAt", () => {
  it("decodes exe addresses as y × 640 + x", () => {
    expect(spriteAt(0xedc2, 32, 16)).toEqual({ x: 66, y: 95, w: 32, h: 16 });
    expect(spriteAt(BRICK_GHOST, 32, 16)).toMatchObject({ x: 198, y: 95 });
  });

  it("puts each brick colour 17 rows lower", () => {
    expect(spriteAt(0xedc2 + 3 * BRICK_COLOR_STRIDE, 32, 16)).toMatchObject({ x: 66, y: 146 });
  });
});

describe("brickSprite (§4, 0x404DD0)", () => {
  it("draws nothing for an empty cell or an unknown family", () => {
    expect(brickSprite(0x00)).toBeNull();
    expect(brickSprite(0x01)).toBeNull();
    expect(brickSprite(0x38)).toBeNull();
  });

  it("1-hit breakable", () => {
    expect(brickSprite(0x21)).toEqual({ address: 0xedc2, cell: 1 });
  });

  it("0x24 and 0x27 are both 4-hit bricks", () => {
    expect(brickSprite(0x24)).toEqual({ address: 0xedc2, cell: 4 });
    expect(brickSprite(0x27)).toEqual({ address: 0xedc2, cell: 4 });
  });

  it("game mode 4 starts multi-hit bricks one frame earlier", () => {
    expect(brickSprite(0x24, 4)).toEqual({ address: 0xeda1, cell: 4 });
    expect(brickSprite(0x21, 4)).toEqual({ address: 0xedc2, cell: 1 });
  });

  it("ghost becomes a 1-hit breakable with its own sprite", () => {
    expect(brickSprite(0x11)).toEqual({ address: BRICK_GHOST, cell: 1 });
  });

  it("indestructible and teleporter", () => {
    expect(brickSprite(0x08)).toEqual({ address: 0x4ac9, cell: 0x0c });
    expect(brickSprite(0x18)).toEqual({ address: 0xee67, cell: 0x1c });
  });

  it("adds the colour offset from bits 7-6", () => {
    expect(brickSprite(0x61)!.address).toBe(0xedc2 + BRICK_COLOR_STRIDE);
    expect(brickSprite(0xe1)!.address).toBe(0xedc2 + 3 * BRICK_COLOR_STRIDE);
    expect(brickSprite(0xd1)!.address).toBe(BRICK_GHOST + 3 * BRICK_COLOR_STRIDE);
  });
});

describe("capsuleSprite (§5.2, 0x40528A)", () => {
  it("steps 26 px per bonus on the capsule row", () => {
    expect(capsuleSprite(0)).toEqual({ x: 1, y: 752, w: 26, h: 24 });
    expect(capsuleSprite(23)).toMatchObject({ x: 1 + 26 * 23, y: 752 });
  });
});
