/**
 * A solo game, recorded as the calls that reach the engine and replayed from them: the server of
 * the website only trusts the score of its own replay (docs/cadrage.md, Scores et classements).
 * The engine only draws from its seeded Rng, so the seed and these calls fix the whole game.
 */
import { Rng } from "../core/rng";
import type { Difficulty, GameConfig } from "../data/config";
import type { Level } from "../data/levels";
import { Game, type GameInput } from "./game";

export const REPLAY_VERSION = 1;

/** Further than any mouse in one tick: beyond it a log can only be forged. */
export const MAX_PADDLE_DX = 4096;

/** 10 hours at 60 ticks per second, a bound on the work of one replay. */
export const MAX_REPLAY_TICKS = 2_160_000;

/** `count` ticks in a row with the same input; `fire` is 0 or 1. */
export type TickRun = [count: number, paddleDx: number, fire: number];
/** P accepted (`"p"`), or the pause ended (`"r"`). */
export type PauseOp = ["p"] | ["r"];
export type ReplayOp = TickRun | PauseOp;

export interface ReplayLog {
  version: number;
  /** Unsigned 32-bit seed of the game's Rng. */
  seed: number;
  ops: ReplayOp[];
}

/** What the engine needs besides the log: the server decides it, never the client. */
export interface ReplaySetup {
  config: GameConfig;
  levels: readonly Level[];
  difficulty: Difficulty;
  spareLifePoints: number;
}

/** The calls main.ts makes on a game. */
export type GameDriver = Pick<Game, "tick" | "startPause" | "endPause">;

/** Sits between the main loop and a solo game, and writes down every call it passes on. */
export class GameRecorder implements GameDriver {
  private readonly ops: ReplayOp[] = [];

  constructor(
    private readonly game: Game,
    private readonly seed: number,
  ) {}

  tick(input: GameInput): void {
    this.game.tick(input);
    const fire = input.fire ? 1 : 0;
    const last = this.ops[this.ops.length - 1];
    if (last && last.length === 3 && last[1] === input.paddleDx && last[2] === fire) last[0]++;
    else this.ops.push([1, input.paddleDx, fire]);
  }

  startPause(): void {
    this.game.startPause();
    this.ops.push(["p"]);
  }

  endPause(): void {
    this.game.endPause();
    this.ops.push(["r"]);
  }

  get log(): ReplayLog {
    return { version: REPLAY_VERSION, seed: this.seed >>> 0, ops: this.ops.map((op) => [...op]) as ReplayOp[] };
  }
}

/** Where a game of the chain ended: a game over starts the next one (0x401FB4). */
export interface GameEnd {
  kind: "gameOver" | "finished";
  score: number;
  level: number;
  /** Ticks played from the first one, pauses included. */
  tick: number;
}

export interface ReplayResult {
  ends: GameEnd[];
  ticks: number;
}

export class ReplayError extends Error {}

const isUint32 = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 0xffffffff;

/** Plays the log again from its seed. Throws a ReplayError on any call a player cannot make. */
export function replay(setup: ReplaySetup, log: ReplayLog): ReplayResult {
  if (log?.version !== REPLAY_VERSION) throw new ReplayError("unknown version");
  if (!isUint32(log.seed)) throw new ReplayError("bad seed");
  if (!Array.isArray(log.ops)) throw new ReplayError("no ops");
  const game = new Game(
    setup.config,
    setup.levels,
    setup.difficulty,
    new Rng(log.seed),
    setup.spareLifePoints,
  );
  const ends: GameEnd[] = [];
  let ticks = 0;
  /** The main loop accepts P before its tick, which still gets the real input (0x4020A8). */
  let pauseJustStarted = false;
  const end = (kind: GameEnd["kind"]) =>
    ends.push({ kind, score: game.player.score, level: game.level, tick: ticks });

  for (const op of log.ops) {
    if (game.finished) throw new ReplayError("input after the end");
    if (!Array.isArray(op)) throw new ReplayError("bad op");
    if (op.length === 1) {
      // Same tests as the main loop: P only where 0x401F37 looks at it, a pause ends once.
      if (op[0] === "p" && !game.paused && game.canPause) {
        game.startPause();
        pauseJustStarted = true;
      } else if (op[0] === "r" && game.paused && !pauseJustStarted) {
        game.endPause();
      } else {
        throw new ReplayError("pause refused");
      }
      continue;
    }
    const [count, paddleDx, fire] = op as unknown[];
    if (op.length !== 3 || !Number.isInteger(count) || (count as number) < 1) {
      throw new ReplayError("bad tick run");
    }
    if (!Number.isInteger(paddleDx) || Math.abs(paddleDx as number) > MAX_PADDLE_DX) {
      throw new ReplayError("bad paddle move");
    }
    if (fire !== 0 && fire !== 1) throw new ReplayError("bad fire");
    if (ticks + (count as number) > MAX_REPLAY_TICKS) throw new ReplayError("too long");
    const input: GameInput = { paddleDx: paddleDx as number, fire: fire === 1 };
    for (let i = 0; i < (count as number); i++) {
      if (game.finished) throw new ReplayError("input after the end");
      // A paused game only gets the empty input of 0x4020C1.
      const empty = input.paddleDx === 0 && !input.fire;
      if (game.paused && !pauseJustStarted && !empty) throw new ReplayError("input in pause");
      pauseJustStarted = false;
      game.tick(input);
      ticks++;
      if (game.scoresDue) {
        game.scoresDue = false;
        end("gameOver");
      }
      if (game.finished) end("finished");
    }
  }
  return { ends, ticks };
}
