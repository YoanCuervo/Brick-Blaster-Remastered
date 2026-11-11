import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { Rng } from "../core/rng";
import { Difficulty } from "../data/config";
import { BallState } from "./ball";
import { Game, GameMode, webConfig } from "./game";
import { EVERY_BRICK_ROW, shortLevel, testConfig } from "./playthrough.testdata";
import {
  type GameEnd,
  GameRecorder,
  MAX_PADDLE_DX,
  MAX_REPLAY_TICKS,
  REPLAY_VERSION,
  type ReplayLog,
  type ReplayOp,
  type ReplaySetup,
  replay,
} from "./replay";
import { SPARE_LIFE_POINTS } from "./score";

const setup: ReplaySetup = {
  config: webConfig(testConfig, Difficulty.Medium),
  levels: Array.from({ length: 8 }, () => shortLevel(EVERY_BRICK_ROW)),
  difficulty: Difficulty.Medium,
  spareLifePoints: SPARE_LIFE_POINTS,
};

const SEED = 7;
/** Ticks where the player presses P, then waits this long before ending the pause. */
const PAUSES = [600, 4000];
const PAUSE_TICKS = 40;
/** From this tick the player leaves the ball until a game over, then plays again. */
const GIVE_UP_AT = 2000;

/**
 * Plays as the main loop drives a game: P only where it is accepted, the empty input of a paused
 * game, scoresDue cleared once seen. Follows the lowest falling ball, except while giving up.
 */
function record(): { log: ReplayLog; ends: GameEnd[]; ticks: number } {
  const game = new Game(setup.config, setup.levels, setup.difficulty, new Rng(SEED), SPARE_LIFE_POINTS);
  const recorder = new GameRecorder(game, SEED);
  const ends: GameEnd[] = [];
  let ticks = 0;
  let pausedFor = -1;
  let givingUp = false;
  const end = (kind: GameEnd["kind"]) =>
    ends.push({ kind, score: game.player.score, level: game.level, tick: ticks });
  while (!game.finished && ticks < 400_000) {
    if (game.paused) {
      recorder.tick({ paddleDx: 0, fire: false });
      ticks++;
      if (++pausedFor >= PAUSE_TICKS) recorder.endPause();
      continue;
    }
    if (PAUSES.includes(ticks) && game.canPause) {
      recorder.startPause();
      pausedFor = 0;
    }
    if (ticks === GIVE_UP_AT) givingUp = true;
    const falling = game.balls
      .filter((b) => b.state === BallState.Active && b.dy >= 0)
      .sort((a, b) => b.y - a.y)[0];
    const target = falling ? falling.x + falling.w / 2 - game.paddle.w / 2 : game.paddle.x;
    const paddleDx = givingUp ? -64 : Math.round(target - game.paddle.x);
    // Giving up still serves, or the ball would wait on the paddle forever.
    const fire = game.mode === GameMode.Ready || (!givingUp && ticks % 8 === 0);
    recorder.tick({ paddleDx, fire });
    ticks++;
    if (game.scoresDue) {
      game.scoresDue = false;
      givingUp = false;
      end("gameOver");
    }
    if (game.finished) end("finished");
  }
  return { log: recorder.log, ends, ticks };
}

const recorded = record();

describe("a recorded game", () => {
  it("goes through pauses and a game over to the end", () => {
    const { log, ends } = recorded;
    expect(ends.map((e) => e.kind)).toEqual(["gameOver", "finished"]);
    expect(log.ops.filter((op) => op[0] === "p")).toHaveLength(PAUSES.length);
    expect(log.ops.filter((op) => op[0] === "r")).toHaveLength(PAUSES.length);
  });

  it("replays to the same ends, through JSON as the server gets it", () => {
    const sent = JSON.parse(JSON.stringify(recorded.log)) as ReplayLog;
    expect(replay(setup, sent)).toEqual({ ends: recorded.ends, ticks: recorded.ticks });
    expect(replay(setup, sent)).toEqual(replay(setup, recorded.log));
  });

  it("depends on its seed", () => {
    const other = { ...recorded.log, seed: SEED + 1 };
    let result: ReturnType<typeof replay> | null = null;
    try {
      result = replay(setup, other);
    } catch {
      // A log is only valid in its own game: refusing it is a different result too.
    }
    expect(result?.ends).not.toEqual(recorded.ends);
  });

  it("weighs a few bytes per tick once compressed", () => {
    const json = JSON.stringify(recorded.log);
    const gzipped = gzipSync(json).length;
    console.log(
      `replay log: ${recorded.ticks} ticks, ${recorded.log.ops.length} ops, ` +
        `${json.length} B of JSON, ${gzipped} B gzipped`,
    );
    expect(gzipped / recorded.ticks).toBeLessThan(2);
  });
});

describe("a forged log", () => {
  const ops = recorded.log.ops;
  const firstPause = ops.findIndex((op) => op[0] === "p");
  const forged = (change: Partial<ReplayLog>) =>
    () => replay(setup, { ...recorded.log, ...change } as ReplayLog);
  const withOps = (o: unknown[]) => forged({ ops: o as ReplayOp[] });

  it("is refused for a bad header", () => {
    expect(forged({ version: REPLAY_VERSION + 1 })).toThrow("unknown version");
    expect(forged({ seed: -1 })).toThrow("bad seed");
    expect(forged({ seed: 1.5 })).toThrow("bad seed");
    expect(forged({ seed: 2 ** 32 })).toThrow("bad seed");
    expect(forged({ ops: "nope" as unknown as ReplayOp[] })).toThrow("no ops");
  });

  it("is refused for a malformed op", () => {
    expect(withOps([["x"]])).toThrow("pause refused");
    expect(withOps([42])).toThrow("bad op");
    expect(withOps([[0, 0, 0]])).toThrow("bad tick run");
    expect(withOps([[1.5, 0, 0]])).toThrow("bad tick run");
    expect(withOps([[1, 0]])).toThrow("bad tick run");
    expect(withOps([[1, 0.5, 0]])).toThrow("bad paddle move");
    expect(withOps([[1, MAX_PADDLE_DX + 1, 0]])).toThrow("bad paddle move");
    expect(withOps([[1, 0, 2]])).toThrow("bad fire");
    expect(withOps([[1, 0, true]])).toThrow("bad fire");
    expect(withOps([[MAX_REPLAY_TICKS + 1, 0, 0]])).toThrow("too long");
  });

  it("is refused for a pause the game does not allow", () => {
    // The game fades in first: P is not looked at (0x401F37).
    expect(withOps([["p"]])).toThrow("pause refused");
    expect(withOps([["r"]])).toThrow("pause refused");
    const paused = ops.slice(0, firstPause + 1);
    expect(withOps([...paused, ["p"]])).toThrow("pause refused");
    expect(withOps([...paused, ["r"]])).toThrow("pause refused");
  });

  it("is refused for a move or a shot during a pause", () => {
    const paused = [...ops.slice(0, firstPause + 1), [1, 3, 0]];
    expect(withOps([...paused, [1, 0, 0]])).not.toThrow();
    expect(withOps([...paused, [1, 1, 0]])).toThrow("input in pause");
    expect(withOps([...paused, [1, 0, 1]])).toThrow("input in pause");
  });

  it("is refused for input after the end", () => {
    expect(withOps([...ops, [1, 0, 0]])).toThrow("input after the end");
    expect(withOps([...ops, ["p"]])).toThrow("input after the end");
  });
});
