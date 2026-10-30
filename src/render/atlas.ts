/** Sprite sheet row length: sprites are addressed as y × 640 + x in the exe. */
export const SHEET_PITCH = 640;

export interface SpriteRef {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function spriteAt(address: number, w: number, h: number): SpriteRef {
  return { x: address % SHEET_PITCH, y: Math.floor(address / SHEET_PITCH), w, h };
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

/** Player 1 paddle, 74 × 25 (0x4025E1). */
export const PADDLE_SPRITE = spriteAt(0x6900, 0x4a, 0x19);

export const CAPSULE_W = 0x1a;
export const CAPSULE_H = 0x18;
const CAPSULE_FIRST = 0x75801;

/** Bonus capsule sprite: code = 0x75801 + 0x1A × table index (§5.2, 0x40528A). */
export function capsuleSprite(bonusIndex: number): SpriteRef {
  return spriteAt(CAPSULE_FIRST + CAPSULE_W * bonusIndex, CAPSULE_W, CAPSULE_H);
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
