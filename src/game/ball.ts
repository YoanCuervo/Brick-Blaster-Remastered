// Ball physics, ported from the original routines (§4.2). Units: pixels per 50 Hz tick.
import type { Rng } from "../core/rng";
import type { BonusKey } from "../data/config";
import type { Level } from "../data/levels";
import { type SpriteAnim, createAnim, stepAnim } from "./animation";
import { touchesIndestructible } from "./bricks";
import { PADDLE_H, PADDLE_X_MIN, PADDLE_Y, PLAY_RIGHT, type Paddle } from "./paddle";

export const BALL_SIZE = 9;
export const SCREEN_BOTTOM = 0x1e0;
/** Sub-step cap of the brick sweep (0x4040BB). */
export const MAX_SAMPLES = 0x12;
/** Width of the paddle's back and front edges (0x404707). */
export const PADDLE_EDGE = 0x17;
/** Wall bounces between two position snapshots of the anti-loop guard (0x4051F7). */
export const ANTI_LOOP_PERIOD = 0x3c;
export const ANTI_LOOP_MATCHES = 3;
/** Ball slots from 0x413048 up to the type 3 objects. */
export const MAX_BALLS = 20;

/** Sprites of a ball [+0x0D]: the iron ball is at the top of the sheet (0x403957). */
export const BALL_SPRITE = 0x1680;
export const IRON_SPRITE = 0;
/** A ghost ball is the sprite next to it (0x403F00), its death further right (0x40466B). */
export const GHOST_OFFSET = 0x12;
export const GHOST_DEATH = 0x16ae;
export const IRON_GHOST_DEATH = 0x2e;
/** [+0x8D] at the paddle contact: the ball goes at 1, after 6 anim steps (0x404684, 0x406717). */
export const GHOST_DEATH_STEPS = 5 + 2;

/** [ball + 1]: 0 = gone, 1 = in play, −3 = past the paddle and about to be lost. */
export const BallState = { Dead: 0, Active: 1, Lost: -3 } as const;
export type BallState = (typeof BallState)[keyof typeof BallState];

export interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  /** Angle mode [+0x19]: 0 = steep, 1 = flat. */
  mode: number;
  state: BallState;
  /** Ticks of climbing left before the next speed-up [+0x5D]. */
  speedCounter: number;
  /** [+0x59]: 0 lets the ball go through bricks (iron ball). */
  bouncesOnBricks: boolean;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  // Anti-loop guard [+0x75], [+0x79], [+0x81], [+0x85].
  loopCount: number;
  loopMatches: number;
  loopX: number;
  loopY: number;
  /** Offset on the paddle while the ball is stuck to it [+0x95], null when free [+0x91]. */
  stuckOffset: number | null;
  /** [+0x0D], [+0x3D] and the animation fields. */
  anim: SpriteAnim;
  /** [+0x99] */
  ghost: boolean;
  /** [+0x8D]: anim steps left before a ghost ball is gone, 0 when not dying. */
  dying: number;
  /** Object type 7 (§5.2): vanishes instead of bouncing, ignores teleports. */
  shot: boolean;
}

/** [0x41104D] bit 0: balls touching the paddle stick to it, the stuck ones follow it. */
export interface Magnet {
  on: boolean;
}

export type BallEvent = "paddle" | "speedUp" | "lost";

/** Bricks seen by the sweep. */
export interface BrickProbe {
  /** Tests (and damages) the cell under a pixel; true when the ball must bounce. */
  hit(x: number, y: number, ball: Ball): boolean;
  /** End of one ball's sweep: the original clears its once-per-sweep marks here (0x404359). */
  endSweep?(): void;
}

/** Ball object as set up in 0x40225E. */
export function createBall(freqChangeSpeed: number): Ball {
  return {
    x: 0,
    y: 0,
    w: BALL_SIZE,
    h: BALL_SIZE,
    dx: 0,
    dy: 0,
    mode: 0,
    state: BallState.Active,
    speedCounter: freqChangeSpeed,
    bouncesOnBricks: true,
    xMin: PADDLE_X_MIN,
    xMax: PLAY_RIGHT - BALL_SIZE,
    yMin: 0,
    yMax: SCREEN_BOTTOM - BALL_SIZE,
    loopCount: 0,
    loopMatches: 0,
    loopX: 0,
    loopY: 0,
    stuckOffset: null,
    anim: createAnim({
      first: BALL_SPRITE,
      w: BALL_SIZE,
      h: BALL_SIZE,
      step: BALL_SIZE,
      frames: 1,
      delay: 1,
      countdown: 1,
    }),
    ghost: false,
    dying: 0,
    shot: false,
  };
}

/** 0x4024C0: random speed of an extra ball, then forced upwards by 0x402440. */
export function extraBallSpeed(ball: Ball, rng: Rng): void {
  const speed = rng.rand(2) + 2;
  ball.dx = speed;
  ball.dy = speed + 1;
  if (rng.rand(1) !== 0) ball.dx--;
  if (rng.rand(1) !== 0) {
    ball.dx++;
    ball.dy--;
    ball.mode = 1;
  }
  if (rng.rand(1) !== 0) ball.dx = -ball.dx;
  if (rng.rand(1) !== 0) ball.dy = -ball.dy;
  if (ball.dy >= 0) ball.dy = -ball.dy;
}

/** 0x40244E: above the paddle, away from its ends and from indestructible bricks. */
export function placeExtraBall(ball: Ball, paddle: Paddle, level: Level, rng: Rng): void {
  do {
    ball.x = rng.rand(paddle.w - 2 * ball.w) + paddle.x + ball.w;
    ball.y = rng.rand(PADDLE_H) + paddle.y - ball.h - PADDLE_H;
  } while (touchesIndestructible(ball, level));
}

/**
 * 0x40240E: fills the slots not in play, a ball about to be lost included, in slot
 * order. With no slot left the remaining balls are dropped.
 */
export function addBalls(
  balls: Ball[],
  count: number,
  paddle: Paddle,
  level: Level,
  freqChangeSpeed: number,
  rng: Rng,
): void {
  let left = count;
  for (let slot = 0; slot < MAX_BALLS && left > 0; slot++) {
    if (balls[slot]?.state === BallState.Active) continue;
    const ball = createBall(freqChangeSpeed);
    extraBallSpeed(ball, rng);
    placeExtraBall(ball, paddle, level, rng);
    balls[slot] = ball;
    left--;
  }
}

/**
 * 0x403ED5: every ball not yet ghost becomes one, then 0x403F16 gives the first ball
 * in play back its normal state.
 */
export function makeGhosts(balls: Ball[]): void {
  for (const ball of balls) {
    if (ball.ghost) continue;
    ball.ghost = true;
    ball.anim.first += GHOST_OFFSET;
    ball.anim.frame += GHOST_OFFSET;
  }
  const first = balls.find((b) => b.state === BallState.Active);
  if (!first) return;
  first.ghost = false;
  first.anim.first -= GHOST_OFFSET;
  first.anim.frame -= GHOST_OFFSET;
}

/** 0x40394B: an iron ball stays so until its object is recreated (0x403866). */
export function makeIron(ball: Ball): void {
  ball.bouncesOnBricks = false;
  const sprite = ball.ghost ? IRON_SPRITE + GHOST_OFFSET : IRON_SPRITE;
  ball.anim.first = sprite;
  ball.anim.frame = sprite;
}

/** 0x40465C: a ghost ball dies on the paddle, with no bounce, no sound and no stick. */
export function ghostContact(ball: Ball): void {
  const { anim } = ball;
  if (anim.first === IRON_GHOST_DEATH || anim.first === GHOST_DEATH) return;
  const sprite = anim.first === BALL_SPRITE + GHOST_OFFSET ? GHOST_DEATH : IRON_GHOST_DEATH;
  anim.first = sprite;
  anim.frame = sprite;
  anim.frames = 5;
  anim.left = 1;
  anim.delay = 1;
  anim.countdown = 1;
  anim.step = ball.w + 1;
  ball.dying = GHOST_DEATH_STEPS;
  ball.dx = 0;
  ball.dy = 0;
}

/** Stepper 0x4066BA on one ball or shot, with the death count 0x406708. */
export function stepBallAnim(ball: Ball): void {
  if (ball.state === BallState.Dead || !stepAnim(ball.anim)) return;
  if (ball.dying !== 0 && --ball.dying === 1) ball.state = BallState.Dead;
}

/** Centred on top of the paddle (0x404FDC). */
export function placeOnPaddle(ball: Ball, paddle: Paddle): void {
  ball.y = paddle.y - ball.h;
  ball.x = paddle.x + (paddle.w >> 1) - (ball.w >> 1);
}

/** 0x4048F7: sticks the ball where it touches the paddle, kept within its width. */
export function stickToPaddle(ball: Ball, paddle: Paddle): void {
  ball.stuckOffset = Math.min(Math.abs(ball.x - paddle.x), paddle.w - ball.w);
}

/** 0x404963: +1 for dx ≥ 0, −1 otherwise. */
const sign = (v: number) => (v < 0 ? -1 : 1);

/** 0x40491D: flat angle. dy is incremented as such, not by its sign. */
export function flatter(ball: Ball, s: number): void {
  if (ball.mode === 1) return;
  const limit = 14 + ball.mode;
  if (ball.dx >= limit || ball.dx <= -limit) return;
  ball.mode = 1;
  ball.dy += 1;
  ball.dx += s;
}

/** 0x40494A: back to the steep angle. */
export function steeper(ball: Ball, s: number): void {
  if (ball.mode === 0) return;
  ball.mode = 0;
  ball.dy -= 1;
  ball.dx -= s;
}

/**
 * 0x4051E3, run on every dx/dy reversal except the paddle one. Every 60 calls the
 * position is stored; finding it again 3 times switches the angle mode. The call
 * that stores the position already counts as a match.
 */
export function antiLoop(ball: Ball): void {
  if (ball.loopCount === 0 || ball.loopCount === ANTI_LOOP_PERIOD) {
    ball.loopCount = 0;
    ball.loopMatches = 0;
    ball.loopX = ball.x;
    ball.loopY = ball.y;
  }
  ball.loopCount++;
  if (ball.x !== ball.loopX || ball.y !== ball.loopY) return;
  if (++ball.loopMatches !== ANTI_LOOP_MATCHES) return;
  ball.loopMatches = 0;
  const s = sign(ball.dx);
  if (ball.mode === 0) flatter(ball, s);
  else steeper(ball, s);
}

/** 0x40407C */
export function flipX(ball: Ball): void {
  ball.dx = -ball.dx;
  antiLoop(ball);
}

/** 0x40408A */
export function flipY(ball: Ball): void {
  ball.dy = -ball.dy;
  antiLoop(ball);
}

/**
 * 0x404610. Only the top of the paddle is tested: a falling ball still bounces
 * when it is already lower, as long as it overlaps horizontally. With the magnet on
 * the ball sticks, the bounce still sets the speed it will leave with (0x4048C9).
 */
export function paddleBounce(ball: Ball, paddle: Paddle, magnet?: Magnet): boolean {
  if (ball.dy < 0) return false;
  if (ball.y + ball.h < paddle.y) return false;
  if (ball.x + ball.w < paddle.x) return false;
  if (ball.x >= paddle.x + paddle.w) return false;

  if (ball.ghost) {
    ghostContact(ball);
    return false;
  }
  if (magnet?.on) stickToPaddle(ball, paddle);
  else ball.stuckOffset = null;
  ball.dy = -ball.dy;
  const s = sign(ball.dx);
  if (ball.dx >= 0) {
    // Moving right: judged on the ball's right edge.
    const edge = ball.x + ball.w;
    if (edge < paddle.x + PADDLE_EDGE) flipX(ball);
    else if (edge > paddle.x + paddle.w - PADDLE_EDGE) flatter(ball, s);
    else steeper(ball, s);
  } else {
    if (ball.x > paddle.x + paddle.w - PADDLE_EDGE) flipX(ball);
    else if (ball.x < paddle.x + PADDLE_EDGE) flatter(ball, s);
    else steeper(ball, s);
  }
  return true;
}

/** 0x404022: reflects when the next position reaches a bound. A shot goes instead (0x40405F). */
export function wallBounce(ball: Ball): void {
  const nx = ball.x + ball.dx;
  if (nx >= ball.xMax || nx <= ball.xMin) {
    if (ball.shot) {
      ball.state = BallState.Dead;
      return;
    }
    flipX(ball);
  }
  const ny = ball.y + ball.dy;
  if (ny >= ball.yMax || ny <= ball.yMin) {
    if (ball.shot) ball.state = BallState.Dead;
    else flipY(ball);
  }
}

/** Number of sub-steps of the sweep (0x404098); 0 for a still ball. */
export function sampleCount(dx: number, dy: number): number {
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  return m === 0 ? 0 : Math.min(m + 1, MAX_SAMPLES);
}

/**
 * Sub-step coordinates from `start` to `end` in 16.16 fixed point (0x4041D2).
 * Entry 0 is stored as `start << 15` by a `sar 1` slip, which always lands out
 * of the grid: it is returned as null.
 */
export function sweepTrack(start: number, end: number, n: number): (number | null)[] {
  const out: (number | null)[] = [null];
  let cur = start * 0x10000;
  const target = end * 0x10000;
  for (let left = n - 1; left > 0; left--) {
    cur += Math.trunc((target - cur) / left);
    out.push(Math.floor(cur / 0x10000));
  }
  return out;
}

/**
 * Bounce code → reversal (0x40436A). Code = sign bits (dx < 0 → 1, dy < 0 → 2)
 * shifted left by 2, plus the corners hit (1 = first, 2 = second).
 */
export function applyBounceCode(ball: Ball, code: number): void {
  if (code === 0) return;
  // 0x4043CB
  if (ball.shot) {
    ball.state = BallState.Dead;
    return;
  }
  if (code === 1 || code === 5 || code === 10 || code === 14) flipX(ball);
  else if (code === 2 || code === 6 || code === 9 || code === 13) flipY(ball);
  else {
    flipX(ball);
    flipY(ball);
  }
}

/**
 * 0x4042BC: follows the two corners on the leading side along the move, probing
 * every sub-step. The first sub-step that hits decides the bounce; the others are
 * still probed (they can damage bricks).
 */
export function brickSweep(ball: Ball, probe: BrickProbe): number {
  const n = sampleCount(ball.dx, ball.dy);
  if (n === 0) return 0;
  const signs = (ball.dx < 0 ? 1 : 0) | (ball.dy < 0 ? 2 : 0);
  const { x, y, w, h, dx, dy } = ball;
  // 0x4040D0: same-sign moves use the anti-diagonal corners.
  const [ax, ay, bx, by] = signs === 0 || signs === 3 ? [x + w, y, x, y + h] : [x, y, x + w, y + h];
  const tAx = sweepTrack(ax, ax + dx, n);
  const tAy = sweepTrack(ay, ay + dy, n);
  const tBx = sweepTrack(bx, bx + dx, n);
  const tBy = sweepTrack(by, by + dy, n);

  let code = 0;
  for (let i = 1; i < n; i++) {
    let corners = 0;
    if (probe.hit(tAx[i]!, tAy[i]!, ball)) corners |= 1;
    if (probe.hit(tBx[i]!, tBy[i]!, ball)) corners |= 2;
    if (corners !== 0 && ball.bouncesOnBricks && code === 0) code = (signs << 2) | corners;
  }
  applyBounceCode(ball, code);
  probe.endSweep?.();
  return code;
}

/**
 * 0x403D8E: with the magnet on, a stuck ball follows the paddle until fire is held
 * (0x403E02), then leaves on the same tick. The first release ends the magnet, so
 * the other stuck balls leave too: with it off their offset is ignored. 0x403DEF is
 * the move itself.
 */
export function moveBall(ball: Ball, paddle?: Paddle, magnet?: Magnet, fire = false): void {
  if (ball.stuckOffset !== null && paddle && magnet?.on) {
    ball.x = paddle.x + ball.stuckOffset;
    ball.y = paddle.y - ball.h;
    if (!fire) return;
    magnet.on = false;
    ball.stuckOffset = null;
  }
  ball.x += ball.dx;
  ball.y += ball.dy;
}

/**
 * 0x4049B5: a falling ball whose centre passes the paddle's middle line is marked
 * lost; it disappears on the first tick it is no longer falling (after bouncing
 * off the bottom).
 */
export function lostCheck(ball: Ball): boolean {
  if (ball.dy >= 0 && PADDLE_Y + (PADDLE_H >> 1) <= ball.y + (ball.h >> 1)) {
    if (ball.state !== BallState.Lost) ball.state = BallState.Lost;
    return false;
  }
  if (ball.y + ball.h <= SCREEN_BOTTOM && ball.state === BallState.Lost) {
    ball.state = BallState.Dead;
    return true;
  }
  return false;
}

/** 0x403FAC / 0x403FC9: one step faster, up to |dx| < 14 + mode and |dy| < 15 − mode. */
export function speedUp(ball: Ball): void {
  const lx = 14 + ball.mode;
  if (ball.dx < lx && ball.dx > -lx) ball.dx += sign(ball.dx);
  const ly = 15 - ball.mode;
  if (ball.dy < ly && ball.dy > -ly) ball.dy += sign(ball.dy);
}

/**
 * 0x403F50: the counter only runs while the ball climbs. The fast ball bonus takes the
 * same speed-up on any tick, silently; true means the counter ran out (0x403F7E, sound).
 */
export function accelerate(ball: Ball, interval: number, fast = false): boolean {
  const ranOut = ball.dy < 0 && --ball.speedCounter === 0;
  if (ranOut || fast) {
    ball.speedCounter = interval;
    speedUp(ball);
  }
  return ranOut;
}

/** 0x403F8D: one step slower down to |dx| = 1 + mode and |dy| = 2 − mode. */
export function slowDown(ball: Ball, interval: number): void {
  ball.speedCounter = interval;
  const lx = 1 + ball.mode;
  if (ball.dx > lx || ball.dx < -lx) ball.dx -= sign(ball.dx);
  const ly = 2 - ball.mode;
  if (ball.dy > ly || ball.dy < -ly) ball.dy -= sign(ball.dy);
}

/** What one ball sees of the rest of the game during a tick. */
export interface BallContext {
  /** Fire held. */
  fire?: boolean;
  magnet?: Magnet;
  /** One-tick bonus in the active slot (§5.2). */
  active?: BonusKey | null;
  /** The telepod bonus (0x4023AA). */
  teleport?: (ball: Ball) => void;
}

/** One tick of one ball, in the order of the main loop (0x403932). */
export function updateBall(
  ball: Ball,
  paddle: Paddle,
  probe: BrickProbe,
  speedInterval: number,
  ctx: BallContext = {},
): BallEvent[] {
  const events: BallEvent[] = [];
  if (ball.state === BallState.Dead) return events;
  const { fire = false, magnet, active = null, teleport } = ctx;
  // A ball about to be lost skips the iron bonus and the paddle (0x403936).
  if (ball.state !== BallState.Lost) {
    if (active === "iron_ball") makeIron(ball);
    if (paddleBounce(ball, paddle, magnet)) events.push("paddle");
  }
  wallBounce(ball);
  brickSweep(ball, probe);
  moveBall(ball, paddle, magnet, fire);
  if (active === "telepod") teleport?.(ball);
  if (lostCheck(ball)) events.push("lost");
  if (accelerate(ball, speedInterval, active === "fast_ball")) events.push("speedUp");
  if (active === "slow_ball") slowDown(ball, speedInterval);
  return events;
}
