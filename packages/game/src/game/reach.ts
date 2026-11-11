// How easily a ball from the paddle gets to each cell of a level. A level-design measure for the
// tests of Limbes: not part of the game, and not in the original.
import { LEVEL_COLS, LEVEL_ROWS, type Level } from "../data/levels";
import { TELEPORT_RANGE, TELEPORT_X, TELEPORT_Y } from "./bricks";
import { PADDLE_X_MIN, PADDLE_Y, PLAY_RIGHT } from "./paddle";

const WALL = 0x08;
const TELEPORTER = 0x18;
const CELL_W = 32;
const CELL_H = 16;
/** |dx| + |dy| stays the same when the paddle bends the ball (§4.2): one family of slopes. */
const SLOPE_SUM = 11;
const START_STEP = 8;
const LANDING_STEP = 16;
const MAX_BOUNCES = 40;
/** Pixels per step: less than a quarter of a cell height. */
const STEP = 2;
const MAX_STEPS = 3000;

interface Trace {
  /** Cells the ball went through or touched, each once. */
  readonly cells: readonly number[];
  readonly teleported: boolean;
}

const CELLS = LEVEL_ROWS * LEVEL_COLS;

function blocking(level: Level, x: number, y: number): "open" | "wall" | "teleporter" {
  if (y < 0 || x < PADDLE_X_MIN || x >= PLAY_RIGHT) return "wall";
  const r = Math.floor(y / CELL_H);
  if (r >= LEVEL_ROWS) return "open";
  const kind = level[r]![Math.floor((x - PADDLE_X_MIN) / CELL_W)]! & 0x3f;
  return kind === WALL ? "wall" : kind === TELEPORTER ? "teleporter" : "open";
}

function cellAt(x: number, y: number): number {
  const r = Math.floor(y / CELL_H);
  const c = Math.floor((x - PADDLE_X_MIN) / CELL_W);
  return r >= 0 && r < LEVEL_ROWS && c >= 0 && c < LEVEL_COLS ? r * LEVEL_COLS + c : -1;
}

/**
 * A point ball in a level where only walls and teleporters are left: it bounces off walls and
 * the play area, and stops back at the paddle, in a teleporter, or after MAX_BOUNCES.
 */
function trace(level: Level, x0: number, y0: number, dx0: number, dy0: number): Trace {
  const seen = new Uint8Array(CELLS);
  const cells: number[] = [];
  const add = (id: number) => {
    if (id >= 0 && seen[id] === 0) {
      seen[id] = 1;
      cells.push(id);
    }
  };
  let [x, y, dx, dy] = [x0, y0, dx0 * STEP, dy0 * STEP];
  let bounces = 0;
  for (let step = 0; step < MAX_STEPS && bounces < MAX_BOUNCES; step++) {
    const nx = x + dx;
    const ny = y + dy;
    if (ny >= PADDLE_Y) break;
    add(cellAt(nx, ny));
    const here = blocking(level, nx, ny);
    if (here === "teleporter") return { cells, teleported: true };
    if (here === "open") {
      [x, y] = [nx, ny];
      continue;
    }
    bounces++;
    add(cellAt(nx, y));
    add(cellAt(x, ny));
    const sideways = blocking(level, nx, y) !== "open";
    const upDown = blocking(level, x, ny) !== "open";
    if (sideways || !upDown) dx = -dx;
    if (upDown || !sideways) dy = -dy;
  }
  return { cells, teleported: false };
}

function slopes(): [number, number][] {
  const out: [number, number][] = [];
  for (let d = 1; d < SLOPE_SUM; d++) {
    const len = Math.hypot(d, SLOPE_SUM - d);
    out.push([d / len, (SLOPE_SUM - d) / len], [-d / len, (SLOPE_SUM - d) / len]);
  }
  return out;
}

/** Share of the traces that touch each cell, or that teleport without touching it. */
function shares(traces: readonly Trace[], afterTeleport: Float64Array | null) {
  const out = new Float64Array(CELLS);
  for (const { cells, teleported } of traces) {
    for (const id of cells) out[id]! += 1;
    if (teleported && afterTeleport) {
      const touched = new Set(cells);
      for (let id = 0; id < CELLS; id++) if (!touched.has(id)) out[id]! += afterTeleport[id]!;
    }
  }
  return out.map((n) => n / traces.length);
}

/**
 * For each cell, the chance that one ball leaving the paddle gets there once every breakable
 * brick but this one is gone: all launch points across the paddle line, all slopes going up.
 * A teleporter sends the ball anywhere in its landing area, going any way (0x405C4F, §4.1).
 */
export function reachChances(level: Level): Float64Array {
  const hasTeleporter = level.some((row) => row.some((b) => (b & 0x3f) === TELEPORTER));
  let afterTeleport: Float64Array | null = null;
  if (hasTeleporter) {
    const landing: Trace[] = [];
    for (let x = TELEPORT_X + 4; x < TELEPORT_X + TELEPORT_RANGE; x += LANDING_STEP) {
      for (let y = TELEPORT_Y + 4; y < TELEPORT_Y + TELEPORT_RANGE; y += LANDING_STEP) {
        if (blocking(level, x, y) !== "open") continue;
        for (const [dx, dy] of slopes()) {
          landing.push(trace(level, x, y, dx, dy), trace(level, x, y, dx, -dy));
        }
      }
    }
    afterTeleport = shares(landing, null);
  }
  const launches: Trace[] = [];
  for (let x = PADDLE_X_MIN + 5; x < PLAY_RIGHT - 5; x += START_STEP) {
    for (const [dx, dy] of slopes()) launches.push(trace(level, x, PADDLE_Y - 1, dx, -dy));
  }
  return shares(launches, afterTeleport);
}
