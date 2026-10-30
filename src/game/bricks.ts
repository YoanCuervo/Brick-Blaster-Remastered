// Live brick grid and brick collisions (§4, §4.1).
import { LEVEL_COLS, type Level } from "../data/levels";
import type { Rng } from "../core/rng";
import { BRICK_COLOR_STRIDE, BRICK_FRAME_STRIDE, BRICK_GHOST, brickSprite } from "../render/atlas";
import { PADDLE_X_MIN, PLAY_RIGHT } from "./paddle";

/** The live grid at 0x4111AD holds 30 rows of 13 (0x186 bytes); levels only fill 24. */
export const GRID_ROWS = 30;
export const GRID_CELLS = LEVEL_COLS * GRID_ROWS;
/** Probe bounds of 0x4043DD (unsigned compares). */
export const GRID_RIGHT = PLAY_RIGHT;
export const GRID_BOTTOM = 0x1a0;

/** Indestructible blink: first frame offset (0x404520), step back per tick (0x405DA9). */
export const BLINK_OFFSET = 0x35200;
export const BLINK_STEP = 0xaa00;
/** Frames at or past this address are blinking (0x404517, 0x405D93). */
export const BLINK_LIMIT = 0xf4c9;

/** Teleporters move to their next frame every 5 ticks, over 6 frames (0x405CB2). */
export const TELEPORTER_TICKS = 5;
export const TELEPORTER_FRAMES_END = 0xc6;

export const Family = { Indestructible: 0x08, Teleporter: 0x18 } as const;

export interface BrickGrid {
  /**
   * Hits left for breakable bricks (1..7). Other families keep their bits and get
   * the hit count forced to 4 like multi-hit bricks: 0x0C indestructible, 0x1C teleporter.
   */
  readonly cells: Uint8Array;
  /** Sprite address of each cell (table 0x411640). */
  readonly frames: Int32Array;
  /** Cells already hit during the current sweep (0x411334). */
  readonly marks: Uint8Array;
  /** Level as loaded, used by the teleporter (§4.1). */
  readonly level: Level;
  /** [0x411C9C] */
  teleporterTicks: number;
  /** [0x411C98]: offset of the next teleporter frame. */
  teleporterNext: number;
  /** Offset of the teleporter frame last drawn: the original only redraws them every 5 ticks. */
  teleporterShown: number;
}

/** 0x404D08: builds the live grid from a level. */
export function createGrid(level: Level): BrickGrid {
  const cells = new Uint8Array(GRID_CELLS);
  const frames = new Int32Array(GRID_CELLS);
  level.forEach((row, r) =>
    row.forEach((byte, c) => {
      const s = brickSprite(byte);
      if (!s) return;
      cells[r * LEVEL_COLS + c] = s.cell;
      frames[r * LEVEL_COLS + c] = s.address;
    }),
  );
  return {
    cells,
    frames,
    marks: new Uint8Array(GRID_CELLS),
    level,
    teleporterTicks: 0,
    teleporterNext: 0,
    teleporterShown: 0,
  };
}

/** Grid index under a pixel, or −1 outside the probe area (0x4043DE..0x404421). */
export function cellIndex(x: number, y: number): number {
  if (x < 0 || x >= GRID_RIGHT || y < 0 || y >= GRID_BOTTOM) return -1;
  return (y >> 4) * LEVEL_COLS + (Math.max(x - PADDLE_X_MIN, 0) >> 5);
}

const isGhostSprite = (frame: number) =>
  frame >= BRICK_GHOST &&
  (frame - BRICK_GHOST) % BRICK_COLOR_STRIDE === 0 &&
  frame <= BRICK_GHOST + 3 * BRICK_COLOR_STRIDE;

export type BrickHit =
  | { kind: "none" }
  /** A monster (object type 6) bounces off any brick without touching it. */
  | { kind: "solid"; index: number }
  | { kind: "damaged"; index: number }
  /** `bounce` is false for a ghost brick (0x4044DD). */
  | { kind: "destroyed"; index: number; bounce: boolean }
  | { kind: "indestructible"; index: number }
  | { kind: "teleporter"; index: number };

const NONE: BrickHit = { kind: "none" };

/**
 * Port of 0x4043DD for one probed pixel. Scoring, the bonus draw, the teleport
 * and the sounds are left to the caller.
 */
export function hitBrick(grid: BrickGrid, x: number, y: number, monster = false): BrickHit {
  const index = cellIndex(x, y);
  if (index < 0) return NONE;
  const cell = grid.cells[index]!;
  if (cell === 0 || cell === 0xff) return NONE;
  if (cell >= 8) {
    if (monster) return { kind: "solid", index };
    if (cell >= Family.Teleporter) return { kind: "teleporter", index };
    if (grid.frames[index]! < BLINK_LIMIT) grid.frames[index]! += BLINK_OFFSET;
    return { kind: "indestructible", index };
  }
  if (grid.marks[index] === 1) return NONE;
  grid.marks[index] = 1;
  if (monster) return { kind: "solid", index };
  const frame = grid.frames[index]!;
  grid.cells[index] = cell - 1;
  grid.frames[index] = frame + BRICK_FRAME_STRIDE;
  if (cell - 1 !== 0) return { kind: "damaged", index };
  return { kind: "destroyed", index, bounce: !isGhostSprite(frame) };
}

/** End of a sweep (0x404359). */
export function clearMarks(grid: BrickGrid): void {
  grid.marks.fill(0);
}

/** 0x405D57, every tick: blinking indestructible bricks step back to their frame. */
export function restoreBlink(grid: BrickGrid): void {
  for (let i = 0; i < GRID_CELLS; i++) {
    if ((grid.cells[i]! & 0x38) === Family.Indestructible && grid.frames[i]! >= BLINK_LIMIT) {
      grid.frames[i]! -= BLINK_STEP;
    }
  }
}

/** 0x405CB2, every tick. */
export function animateTeleporters(grid: BrickGrid): void {
  if (++grid.teleporterTicks < TELEPORTER_TICKS) return;
  grid.teleporterTicks = 0;
  grid.teleporterShown = grid.teleporterNext;
  grid.teleporterNext += BRICK_FRAME_STRIDE;
  if (grid.teleporterNext >= TELEPORTER_FRAMES_END) grid.teleporterNext = 0;
}

/** Sprite address to draw for a cell, or null for an empty one. */
export function cellSprite(grid: BrickGrid, index: number): number | null {
  const cell = grid.cells[index]!;
  if (cell === 0 || cell === 0xff) return null;
  const frame = grid.frames[index]!;
  return (cell & 0x38) === Family.Teleporter ? frame + grid.teleporterShown : frame;
}

/** 0x4045B2: the level ends when no breakable brick (1..7) is left. */
export function isLevelCleared(grid: BrickGrid): boolean {
  return !grid.cells.some((c) => c >= 1 && c < 8);
}

/** Teleport landing zone (0x4023AF): x 212..428, y 100..316. */
export const TELEPORT_X = 0xd4;
export const TELEPORT_Y = 0x64;
export const TELEPORT_RANGE = 0xd8;

export interface Box {
  x: number;
  y: number;
  readonly w: number;
  readonly h: number;
}

/** 0x40252D: is the pixel on an indestructible brick of the level as loaded? */
function onIndestructible(level: Level, x: number, y: number): boolean {
  const byte = level[y >> 4]?.[(x - PADDLE_X_MIN) >> 5] ?? 0;
  return (byte & 0x38) === Family.Indestructible;
}

/** 0x4023AA: random landing spot whose 4 corners avoid indestructible bricks. */
export function teleport(obj: Box, level: Level, rng: Rng): void {
  do {
    obj.x = TELEPORT_X + rng.rand(TELEPORT_RANGE);
    obj.y = TELEPORT_Y + rng.rand(TELEPORT_RANGE);
  } while (
    onIndestructible(level, obj.x, obj.y) ||
    onIndestructible(level, obj.x, obj.y + obj.h) ||
    onIndestructible(level, obj.x + obj.w, obj.y) ||
    onIndestructible(level, obj.x + obj.w, obj.y + obj.h)
  );
}
