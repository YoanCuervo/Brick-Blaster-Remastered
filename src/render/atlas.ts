/** Sprite sheet row length: sprites are addressed as y × 640 + x in the exe. */
export const SHEET_PITCH = 640;

export interface SpriteRef {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function spriteAt(address: number, w: number, h: number, pitch = SHEET_PITCH): SpriteRef {
  return { x: address % pitch, y: Math.floor(address / pitch), w, h };
}

export const BRICK_W = 32;
export const BRICK_H = 16;
/** One brick colour (bits 7-6) further down the sheet: 17 rows (§4, 0x404E5C). */
export const BRICK_COLOR_STRIDE = 0x2a80;
/** Next damage frame of a multi-hit brick (0x40447E). */
export const BRICK_FRAME_STRIDE = 0x21;

// Base sprite per brick family (bits 5-3), routine 0x404DD0.
const BRICK_BREAKABLE = 0xedc2;
const BRICK_BREAKABLE_MODE4 = 0xeda1;
const BRICK_INDESTRUCTIBLE = 0x4ac9;
const BRICK_TELEPORTER = 0xee67;
export const BRICK_GHOST = 0xee46;

export interface BrickSprite {
  /** Sprite address in the sheet. */
  readonly address: number;
  /** Value stored in the live grid: hits left for breakable bricks. */
  readonly cell: number;
}

/**
 * Port of 0x404DD0. Returns null for an empty cell or an unknown family.
 * `gameMode` is [0x411000]; its meaning is undocumented, mode 4 only changes the
 * first frame of multi-hit bricks.
 */
export function brickSprite(byte: number, gameMode = 0): BrickSprite | null {
  if (byte === 0) return null;
  let b = byte & 0xff;
  let address = 0;
  switch (b & 0x38) {
    case 0x20:
      address = BRICK_BREAKABLE;
      break;
    case 0x08:
      address = BRICK_INDESTRUCTIBLE;
      break;
    case 0x18:
      address = BRICK_TELEPORTER;
      break;
    case 0x10:
      // Ghost bricks become breakable ones with a dedicated sprite.
      b = (b & ~0x38) | 0x20;
      address = BRICK_GHOST;
      break;
  }
  if ((b & 0x1f) > 1) {
    // Any hit count above 1 becomes 4 (0x404E33).
    b = (b & 0xf8) | 4;
    if (gameMode === 4 && address === BRICK_BREAKABLE) address = BRICK_BREAKABLE_MODE4;
  }
  if (address === 0) return null;
  address += ((b & 0xc0) >> 6) * BRICK_COLOR_STRIDE;
  return { address, cell: b & 0x1f };
}

export const CAPSULE_W = 0x1a;
export const CAPSULE_H = 0x18;
/** From the capsule row to the HUD icons, two rows of 25 lines down (0x4055EF). */
const HUD_ICON_OFFSET = 0x7d501 - 0x75801;

/** Falling capsule of a bonus code (§5.2). */
export function capsuleSprite(code: number): SpriteRef {
  return spriteAt(code, CAPSULE_W, CAPSULE_H);
}

/** Active-bonus icon: same picture, with a frame in colours 112..127 (§3.5). */
export function hudIconSprite(code: number): SpriteRef {
  return spriteAt(code + HUD_ICON_OFFSET, CAPSULE_W, CAPSULE_H);
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  ref: SpriteRef,
  x: number,
  y: number,
): void {
  ctx.drawImage(sheet, ref.x, ref.y, ref.w, ref.h, x, y, ref.w, ref.h);
}

/** Spare-life icons, 9 × 9 every 12 px, taken from the right of the sheet's top row (0x405BC1). */
export const LIFE_ICONS = 0x277;
export const LIFE_ICON_PITCH = 0xc;
export const LIFE_ICON_SIZE = 9;

/**
 * Strip ending at the sheet's right edge, widened to the left by 12 px per spare
 * life. Its last 9 px are blank, so it shows exactly `lives` icons.
 */
export function lifeIcons(lives: number): SpriteRef {
  const n = Math.max(lives, 0);
  return spriteAt(
    LIFE_ICONS - LIFE_ICON_PITCH * n,
    LIFE_ICON_SIZE + LIFE_ICON_PITCH * n,
    LIFE_ICON_SIZE,
  );
}

/** Side walls laid on the background in 0x40575F: 42 × 96 tiles, 5 high. */
export const WALL_W = 0x2a;
export const WALL_H = 0x60;
export const WALL_TILES = 5;
export const WALL_LEFT = spriteAt(0x5f743, WALL_W, WALL_H);
export const WALL_RIGHT = spriteAt(0x50743, WALL_W, WALL_H);
