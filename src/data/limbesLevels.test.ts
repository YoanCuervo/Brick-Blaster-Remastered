import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVEL_COLS, LEVEL_ROWS, type Level, parseLevels } from "./levels";
import { LIMBES_LEVELS } from "./limbesLevels";

const kindOf = (brick: number) => brick & 0x3f;
const WALL = 0x08;
const TELEPORTER = 0x18;
const BREAKABLE = [0x21, 0x24, 0x11];
/** §4: bricks of the shipped levels stop at row 25, the 0x1A0 limit of the collisions. */
const LAST_BRICK_ROW = 25;
/** §4.1: x 212..428, y 100..316, in cells of 32 × 16 from x = 112. */
const LANDING = { rows: [6, 19], cols: [3, 9] } as const;

const cells = (grid: Level) =>
  grid.flatMap((row, r) => row.map((brick, c) => ({ r, c, kind: kindOf(brick) })));
const blocks = (kind: number) => kind === WALL || kind === TELEPORTER;

/** Cells the ball can get to from `seeds`, breakable bricks being only a delay. */
function flood(grid: Level, seeds: readonly (readonly [number, number])[]): Set<number> {
  const seen = new Set<number>();
  const stack = [...seeds];
  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    if (r < 0 || r >= LEVEL_ROWS || c < 0 || c >= LEVEL_COLS) continue;
    const id = r * LEVEL_COLS + c;
    if (seen.has(id) || blocks(kindOf(grid[r]![c]!))) continue;
    seen.add(id);
    stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  return seen;
}

const touchesTeleporter = (grid: Level, region: Set<number>) =>
  cells(grid).some(
    ({ r, c, kind }) =>
      kind === TELEPORTER &&
      [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1],
      ].some(([nr, nc]) => region.has(nr! * LEVEL_COLS + nc!)),
  );

type Shape = readonly (readonly boolean[])[];

/** Filled cells without the empty rows above and below: a figure moved up or down stays itself. */
function shapeOf(grid: Level): Shape {
  const rows = grid.map((row) => row.map((brick) => kindOf(brick) !== 0));
  const filled = rows.flatMap((row, r) => (row.some(Boolean) ? [r] : []));
  return rows.slice(filled[0], filled[filled.length - 1]! + 1);
}

/** Shared cells over all filled cells, at the best height, mirrored or not. */
function resemblance(a: Shape, b: Shape): number {
  let best = 0;
  for (const other of [b, b.map((row) => [...row].reverse())]) {
    for (let shift = -other.length; shift <= a.length; shift++) {
      let shared = 0;
      let total = 0;
      for (let r = Math.min(0, shift); r < Math.max(a.length, shift + other.length); r++) {
        for (let c = 0; c < LEVEL_COLS; c++) {
          const x = a[r]?.[c] ?? false;
          const y = other[r - shift]?.[c] ?? false;
          if (x && y) shared++;
          if (x || y) total++;
        }
      }
      best = Math.max(best, shared / total);
    }
  }
  return best;
}

const landingCells = (): (readonly [number, number])[] => {
  const out: (readonly [number, number])[] = [];
  for (let r = LANDING.rows[0]; r <= LANDING.rows[1]; r++) {
    for (let c = LANDING.cols[0]; c <= LANDING.cols[1]; c++) out.push([r, c]);
  }
  return out;
};

describe("the levels of Limbes", () => {
  it("are 50 grids the level parser accepts", () => {
    expect(LIMBES_LEVELS).toHaveLength(50);
    const parsed = parseLevels({ lv0: LIMBES_LEVELS, lv1: [], lv2: [] });
    expect(parsed.lv0).toEqual(LIMBES_LEVELS);
  });

  it("only use the brick values of the original, 0x27 aside (§4)", () => {
    const allowed = [0, WALL, TELEPORTER, ...BREAKABLE];
    for (const grid of LIMBES_LEVELS) {
      for (const { kind } of cells(grid)) expect(allowed).toContain(kind);
    }
  });

  it("keep their bricks between rows 2 and 25, like the shipped levels (§4)", () => {
    LIMBES_LEVELS.forEach((grid, i) => {
      const rows = cells(grid)
        .filter((cell) => cell.kind !== 0)
        .map((cell) => cell.r);
      expect(Math.min(...rows), `level ${i + 1}`).toBeGreaterThanOrEqual(2);
      expect(Math.max(...rows), `level ${i + 1}`).toBeLessThanOrEqual(LAST_BRICK_ROW);
    });
  });

  it("all have something to break", () => {
    LIMBES_LEVELS.forEach((grid, i) => {
      const left = cells(grid).filter((cell) => BREAKABLE.includes(cell.kind));
      expect(left.length, `level ${i + 1}`).toBeGreaterThan(0);
    });
  });

  it("let the ball reach every breakable brick, from the paddle or through a teleporter", () => {
    LIMBES_LEVELS.forEach((grid, i) => {
      const reached = flood(grid, [[LEVEL_ROWS - 1, 0]]);
      if (touchesTeleporter(grid, reached)) {
        for (const id of flood(grid, landingCells())) reached.add(id);
      }
      for (const { r, c, kind } of cells(grid)) {
        if (BREAKABLE.includes(kind)) {
          expect(reached.has(r * LEVEL_COLS + c), `level ${i + 1}, row ${r}, col ${c}`).toBe(true);
        }
      }
    });
  });

  it("never lock the ball in: a closed room has a teleporter out", () => {
    LIMBES_LEVELS.forEach((grid, i) => {
      for (const seed of landingCells()) {
        const region = flood(grid, [seed]);
        if (region.size === 0 || region.has((LEVEL_ROWS - 1) * LEVEL_COLS)) continue;
        expect(touchesTeleporter(grid, region), `level ${i + 1}, from ${seed}`).toBe(true);
      }
    });
  });

  it("are all different", () => {
    const shapes = LIMBES_LEVELS.map((grid) =>
      cells(grid)
        .map((cell) => cell.kind)
        .join(),
    );
    expect(new Set(shapes).size).toBe(LIMBES_LEVELS.length);
  });

  it("do not repeat a figure", () => {
    const shapes = LIMBES_LEVELS.map(shapeOf);
    const close: string[] = [];
    shapes.forEach((a, i) => {
      for (let j = i + 1; j < shapes.length; j++) {
        const r = resemblance(a, shapes[j]!);
        if (r >= 0.7) close.push(`${i + 1}-${j + 1}: ${r.toFixed(2)}`);
      }
    });
    expect(close).toEqual([]);
  });

  // The asset pack is never versioned: these run only where it has been extracted.
  it.skipIf(!existsSync("assets/levels.json"))(
    "do not repeat a figure of the original",
    () => {
      const pack = parseLevels(JSON.parse(readFileSync("assets/levels.json", "utf8")));
      const originals = [...pack.lv0, ...pack.lv1, ...pack.lv2].filter((grid) =>
        grid.some((row) => row.some((brick) => kindOf(brick) !== 0)),
      );
      const close: string[] = [];
      LIMBES_LEVELS.forEach((grid, i) => {
        originals.forEach((original, j) => {
          const r = resemblance(shapeOf(grid), shapeOf(original));
          if (r >= 0.85) close.push(`${i + 1} and original ${j + 1}: ${r.toFixed(2)}`);
        });
      });
      expect(close).toEqual([]);
    },
    60_000,
  );

  it.skipIf(!existsSync("assets/levels.json"))("copy no level of the original", () => {
    const pack = parseLevels(JSON.parse(readFileSync("assets/levels.json", "utf8")));
    const originals = [...pack.lv0, ...pack.lv1, ...pack.lv2];
    const filled = (grid: Level) =>
      new Set(
        cells(grid)
          .filter((cell) => cell.kind !== 0)
          .map((cell) => `${cell.r},${cell.c},${cell.kind}`),
      );
    LIMBES_LEVELS.forEach((grid, i) => {
      const mine = filled(grid);
      for (const original of originals) {
        const theirs = filled(original);
        const shared = [...mine].filter((cell) => theirs.has(cell)).length;
        const overlap = shared / new Set([...mine, ...theirs]).size;
        expect(overlap, `level ${i + 1}`).toBeLessThan(0.8);
      }
    });
  });
});
