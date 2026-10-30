import { describe, expect, it } from "vitest";
import { Rng } from "../core/rng";
import { LEVEL_COLS, LEVEL_ROWS, type Level } from "../data/levels";
import {
  BLINK_OFFSET,
  GRID_CELLS,
  animateTeleporters,
  cellIndex,
  cellSprite,
  clearMarks,
  createGrid,
  hitBrick,
  isLevelCleared,
  restoreBlink,
  teleport,
} from "./bricks";

/** Level with the given bytes on its top row, the rest empty. */
function level(top: number[] = [], fill = 0): Level {
  return Array.from({ length: LEVEL_ROWS }, (_, r) =>
    Array.from({ length: LEVEL_COLS }, (_, c) => (r === 0 ? (top[c] ?? 0) : fill)),
  );
}

/** Centre of the brick at (row, col). */
const at = (row: number, col: number) => [0x70 + col * 32 + 16, row * 16 + 8] as const;

describe("createGrid (0x404D08)", () => {
  it("stores hits left, families and sprites", () => {
    const g = createGrid(level([0x21, 0x24, 0x27, 0x11, 0x08, 0x18, 0x61]));
    expect(Array.from(g.cells.slice(0, 8))).toEqual([1, 4, 4, 1, 0x0c, 0x1c, 1, 0]);
    expect(Array.from(g.frames.slice(0, 7))).toEqual([
      0xedc2, 0xedc2, 0xedc2, 0xee46, 0x4ac9, 0xee67, 0xedc2 + 0x2a80,
    ]);
    expect(g.cells.length).toBe(GRID_CELLS);
  });
});

describe("cellIndex (0x4043DD)", () => {
  it("maps pixels to cells, left of the grid counting as column 0", () => {
    expect(cellIndex(0x70, 0)).toBe(0);
    expect(cellIndex(0, 16)).toBe(13);
    expect(cellIndex(0x20f, 0x19f)).toBe(25 * 13 + 12);
  });

  it("rejects pixels outside, as unsigned compares do", () => {
    expect(cellIndex(0x210, 0)).toBe(-1);
    expect(cellIndex(0x100, 0x1a0)).toBe(-1);
    expect(cellIndex(-1, 0)).toBe(-1);
    expect(cellIndex(0x100, -1)).toBe(-1);
  });
});

describe("hitBrick (0x4043DD)", () => {
  it("damages a multi-hit brick once per sweep, advancing its frame", () => {
    const g = createGrid(level([0x24]));
    expect(hitBrick(g, ...at(0, 0))).toEqual({ kind: "damaged", index: 0 });
    expect(g.cells[0]).toBe(3);
    expect(g.frames[0]).toBe(0xedc2 + 0x21);
    expect(hitBrick(g, ...at(0, 0))).toEqual({ kind: "none" });
    clearMarks(g);
    expect(hitBrick(g, ...at(0, 0)).kind).toBe("damaged");
  });

  it("destroys a brick at 0 hits, bouncing except for ghosts", () => {
    const g = createGrid(level([0x21, 0x11, 0xd1]));
    expect(hitBrick(g, ...at(0, 0))).toEqual({ kind: "destroyed", index: 0, bounce: true });
    expect(hitBrick(g, ...at(0, 1))).toEqual({ kind: "destroyed", index: 1, bounce: false });
    expect(hitBrick(g, ...at(0, 2))).toEqual({ kind: "destroyed", index: 2, bounce: false });
    expect(cellSprite(g, 0)).toBeNull();
    expect(isLevelCleared(g)).toBe(true);
  });

  it("makes indestructible bricks blink without marking them", () => {
    const g = createGrid(level([0x08]));
    expect(hitBrick(g, ...at(0, 0)).kind).toBe("indestructible");
    expect(g.frames[0]).toBe(0x4ac9 + BLINK_OFFSET);
    expect(hitBrick(g, ...at(0, 0)).kind).toBe("indestructible");
    expect(g.frames[0]).toBe(0x4ac9 + BLINK_OFFSET);
    expect(g.cells[0]).toBe(0x0c);
  });

  it("reports teleporters", () => {
    const g = createGrid(level([0x18]));
    expect(hitBrick(g, ...at(0, 0))).toEqual({ kind: "teleporter", index: 0 });
  });

  it("lets monsters bounce off any brick without damage", () => {
    const g = createGrid(level([0x21, 0x08, 0x18]));
    expect(hitBrick(g, ...at(0, 0), true)).toEqual({ kind: "solid", index: 0 });
    expect(g.cells[0]).toBe(1);
    // The once-per-sweep mark is set before the monster test.
    expect(hitBrick(g, ...at(0, 0), true)).toEqual({ kind: "none" });
    expect(hitBrick(g, ...at(0, 1), true).kind).toBe("solid");
    expect(g.frames[1]).toBe(0x4ac9);
    expect(hitBrick(g, ...at(0, 2), true).kind).toBe("solid");
  });
});

describe("restoreBlink (0x405D57)", () => {
  it("steps back to the normal frame in 5 ticks", () => {
    const g = createGrid(level([0xc8]));
    const base = g.frames[0]!;
    hitBrick(g, ...at(0, 0));
    for (let i = 4; i >= 0; i--) {
      restoreBlink(g);
      expect(g.frames[0]).toBe(base + i * 0xaa00);
    }
    restoreBlink(g);
    expect(g.frames[0]).toBe(base);
  });
});

describe("animateTeleporters (0x405CB2)", () => {
  it("shows a new frame every 5 ticks, cycling over 6", () => {
    const g = createGrid(level([0x18]));
    const shown: number[] = [];
    for (let t = 0; t < 40; t++) {
      animateTeleporters(g);
      shown.push(cellSprite(g, 0)! - 0xee67);
    }
    expect(shown.filter((_, i) => i % 5 === 4)).toEqual([0, 0x21, 0x42, 0x63, 0x84, 0xa5, 0, 0x21]);
    expect(shown.slice(0, 9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("isLevelCleared (0x4045B2)", () => {
  it("only counts breakable bricks", () => {
    expect(isLevelCleared(createGrid(level([0x08, 0x18])))).toBe(true);
    expect(isLevelCleared(createGrid(level()))).toBe(true);
    expect(isLevelCleared(createGrid(level([0x08, 0x24])))).toBe(false);
  });
});

describe("teleport (0x4023AA)", () => {
  it("lands in the 216 px square, off indestructible bricks", () => {
    const lvl = level([], 0x08).map((row, r) => row.map((b, c) => (r === 10 && c === 7 ? 0 : b)));
    const rng = new Rng(7);
    for (let i = 0; i < 20; i++) {
      const box = { x: 0, y: 0, w: 9, h: 9 };
      teleport(box, lvl, rng);
      // Only cell (10, 7) is free: x 336..367, y 160..175, with room for the ball.
      expect(box.x).toBeGreaterThanOrEqual(336);
      expect(box.x + 9).toBeLessThanOrEqual(367);
      expect(box.y).toBeGreaterThanOrEqual(160);
      expect(box.y + 9).toBeLessThanOrEqual(175);
    }
  });

  it("can land on breakable bricks", () => {
    const box = { x: 0, y: 0, w: 9, h: 9 };
    teleport(box, level([], 0x21), new Rng(1));
    expect(box.x).toBeGreaterThanOrEqual(212);
    expect(box.x).toBeLessThanOrEqual(428);
    expect(box.y).toBeGreaterThanOrEqual(100);
    expect(box.y).toBeLessThanOrEqual(316);
  });
});
