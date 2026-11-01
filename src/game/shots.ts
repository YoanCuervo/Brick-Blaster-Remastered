// Shots and cannons of the two shoot bonuses, ported from 0x402828 and 0x403A39 (§5.2).
import { type AnimSpec, type SpriteAnim, createAnim, stepAnim } from "./animation";
import {
  type Ball,
  BallState,
  type BrickProbe,
  SCREEN_BOTTOM,
  brickSweep,
  createBall,
  moveBall,
  stepBallAnim,
  wallBounce,
} from "./ball";
import { PLAY_RIGHT, type Paddle } from "./paddle";

/** Type 7 slots from 0x414509. */
export const MAX_SHOTS = 20;
export const SHOT_DY = -4;
/** Shots start this far above the paddle's top (0x40296C). */
export const SHOT_Y_OFFSET = 0x12;

/** Big shot (0x402982): goes through bricks, one per catch. */
export const BIG_SHOT = {
  w: 8,
  h: 0x2a,
  sprite: 0x3513c,
  bouncesOnBricks: false,
  frames: 0xb,
  delay: 5,
  step: 8 + 3,
};
/** Mini shot (0x402A22): vanishes on the first brick. */
export const MINI_SHOT = {
  w: 3,
  h: 0xd,
  sprite: 0x19a55,
  bouncesOnBricks: true,
  frames: 1,
  delay: 1,
  step: 3 + 1,
};

/** Paddle x offsets of the mini shots (0x402ACD, 0x402A80). */
export const MINI_SHOT_LEFT_DX = 7;
export const MINI_SHOT_RIGHT_DX = 0x3d;

/** Ticks a cannon animates, then its frames count drops to 1 and it freezes (0x402BD5). */
export const MINI_CANNON_TICKS = 0xc;
export const BIG_CANNON_TICKS = 0xa;

export interface Cannon {
  /** [+1]: 1 while its bonus is active. */
  on: boolean;
  x: number;
  y: number;
  readonly dx: number;
  readonly dy: number;
  readonly anim: SpriteAnim;
  /** Countdown 0x402BD5, 0x402BD9 or 0x402BDD. */
  freeze: number;
}

function createCannon(dx: number, dy: number, spec: AnimSpec): Cannon {
  return { on: false, x: 0, y: 0, dx, dy, anim: createAnim(spec), freeze: 0 };
}

export interface ShotSystem {
  /** Slot order, drawn after the cannons (0x40675F). */
  shots: Ball[];
  readonly miniLeft: Cannon;
  readonly miniRight: Cannon;
  readonly big: Cannon;
  /** 0x406304 and 0x40618C: cannon set up once while the flag is off. */
  miniReady: boolean;
  bigReady: boolean;
  /** [0x415756]: the button must be released between two shots. */
  latch: boolean;
  /** [0x415752]: side of the next mini shot. */
  leftNext: boolean;
}

const MINI_CANNON_W = 0xc;
const MINI_CANNON_H = 0x12;
/** Next frame is 37 rows down, the frames sit in columns (0x402689). */
const MINI_CANNON_STEP = MINI_CANNON_W + 0x5c74;
const BIG_CANNON_W = 0xd;
const BIG_CANNON_H = 0x13;

function miniCannonSpec(first: number): AnimSpec {
  return {
    first,
    w: MINI_CANNON_W,
    h: MINI_CANNON_H,
    step: MINI_CANNON_STEP,
    frames: 6,
    delay: 1,
    countdown: 1,
  };
}

export const MINI_LEFT_SPEC = miniCannonSpec(0x1caf6);
export const MINI_RIGHT_SPEC = miniCannonSpec(0x1cb12);
export const BIG_CANNON_SPEC: AnimSpec = {
  first: 0x40a3e,
  w: BIG_CANNON_W,
  h: BIG_CANNON_H,
  step: BIG_CANNON_W + 1,
  frames: 4,
  delay: 1,
  countdown: 1,
};

/** Objects reset by 0x40222D and 0x4025B0 at the start of a round. */
export function createShotSystem(): ShotSystem {
  return {
    shots: [],
    miniLeft: createCannon(7, -7, MINI_LEFT_SPEC),
    miniRight: createCannon(0x37, -7, MINI_RIGHT_SPEC),
    big: createCannon(0x1f, -8, BIG_CANNON_SPEC),
    miniReady: false,
    bigReady: false,
    latch: false,
    leftNext: false,
  };
}

/** 0x40222D: empties the slots. The latch and the side are globals left as they are. */
export function resetShotSystem(s: ShotSystem): ShotSystem {
  return { ...createShotSystem(), latch: s.latch, leftNext: s.leftNext };
}

function rewind(c: Cannon, frames: number, left: number, ticks: number): void {
  const { anim } = c;
  anim.delay = 1;
  anim.countdown = 1;
  anim.frame = anim.first;
  anim.frames = frames;
  anim.left = left;
  c.freeze = ticks;
}

/** 0x406195, the routine of mini_shoot. */
export function setupMiniCannons(s: ShotSystem): void {
  if (s.miniReady) return;
  s.miniReady = true;
  rewind(s.miniLeft, 6, 6, MINI_CANNON_TICKS);
  rewind(s.miniRight, 6, 6, MINI_CANNON_TICKS);
}

/** 0x4060BD, the routine of shoot. */
export function setupBigCannon(s: ShotSystem): void {
  if (s.bigReady) return;
  s.bigReady = true;
  rewind(s.big, 4, 1, BIG_CANNON_TICKS);
}

/** 0x402B71 */
function clearMini(s: ShotSystem): void {
  s.miniReady = false;
  s.miniLeft.on = false;
  s.miniRight.on = false;
}

/** 0x402BAD */
function clearBig(s: ShotSystem): void {
  s.bigReady = false;
  s.big.on = false;
}

/** 0x40303F, 0x4031D1 and 0x4025B0: the setup flags are left alone. */
export function hideCannons(s: ShotSystem): void {
  s.miniLeft.on = false;
  s.miniRight.on = false;
  s.big.on = false;
}

function countDown(c: Cannon): void {
  if (c.freeze === 0) return;
  if (--c.freeze === 0) c.anim.frames = 1;
}

function createShot(kind: typeof BIG_SHOT | typeof MINI_SHOT, x: number, paddle: Paddle): Ball {
  const { w, h, sprite, bouncesOnBricks, frames, delay, step } = kind;
  const ball = createBall(0);
  return {
    ...ball,
    shot: true,
    w,
    h,
    x,
    y: paddle.y - SHOT_Y_OFFSET,
    dx: 0,
    dy: SHOT_DY,
    bouncesOnBricks,
    xMax: PLAY_RIGHT - w,
    yMax: SCREEN_BOTTOM - h,
    anim: {
      ...createAnim({ first: sprite, w, h, step, frames, delay, countdown: delay }),
      left: frames,
    },
  };
}

export type ShotKind = "shoot" | "mini_shoot";

/**
 * 0x402828, mode 3. Returns the kind of shot fired this tick. A shot with all slots
 * taken is lost and the latch stays off.
 */
export function updateCannons(
  s: ShotSystem,
  active: ShotKind | null,
  fire: boolean,
  paddle: Paddle,
): ShotKind | null {
  if (active === null) {
    clearMini(s);
    clearBig(s);
    s.latch = false;
    return null;
  }
  if (active === "mini_shoot") {
    clearBig(s);
    s.miniLeft.on = true;
    s.miniRight.on = true;
  } else {
    clearMini(s);
    s.big.on = true;
  }
  countDown(s.miniLeft);
  countDown(s.miniRight);
  countDown(s.big);

  if (!fire) {
    s.latch = false;
    return null;
  }
  if (s.latch) return null;
  let slot = 0;
  while (slot < MAX_SHOTS && s.shots[slot]?.state === BallState.Active) slot++;
  if (slot === MAX_SHOTS) {
    s.latch = false;
    return null;
  }
  if (active === "shoot") {
    const x = paddle.x + ((paddle.w - BIG_SHOT.w) >> 1);
    s.shots[slot] = createShot(BIG_SHOT, x, paddle);
  } else {
    s.leftNext = !s.leftNext;
    const cannon = s.leftNext ? s.miniLeft : s.miniRight;
    const dx = s.leftNext ? MINI_SHOT_LEFT_DX : MINI_SHOT_RIGHT_DX;
    s.shots[slot] = createShot(MINI_SHOT, paddle.x + dx, paddle);
    rewind(cannon, 6, 1, MINI_CANNON_TICKS);
  }
  s.latch = true;
  return active;
}

/** Right bound the cannons keep from 0x40222D (a 9 px object), enforced by 0x40687F. */
const CANNON_X_MAX = PLAY_RIGHT - 9;

/** 0x406E2A, after the paddle move. */
export function placeCannons(s: ShotSystem, paddle: Paddle): void {
  for (const c of [s.miniLeft, s.miniRight, s.big]) {
    c.x = Math.min(paddle.x + c.dx, CANNON_X_MAX);
    c.y = paddle.y + c.dy;
  }
}

/** 0x403A39: bricks only in mode 3, so in the wait loops shots just keep moving. */
export function updateShots(s: ShotSystem, probe: BrickProbe | null): void {
  for (const shot of s.shots) {
    if (shot.state === BallState.Dead) continue;
    wallBounce(shot);
    if (probe) brickSweep(shot, probe);
    moveBall(shot);
  }
}

/** Their part of the stepper 0x4066BA. */
export function stepShotSystem(s: ShotSystem): void {
  for (const c of [s.miniLeft, s.miniRight, s.big]) {
    if (c.on) stepAnim(c.anim);
  }
  for (const shot of s.shots) stepBallAnim(shot);
}
