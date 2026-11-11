// Monsters (object type 6), ported from 0x403ADA and 0x403C69 (§4.3).
import type { Rng } from "../core/rng";
import { createAnim, type SpriteAnim } from "./animation";
import {
  type Ball,
  BallState,
  type BrickProbe,
  SCREEN_BOTTOM,
  applyBounceCode,
  brickSweep,
  createBall,
  moveBall,
  stepBallAnim,
  wallBounce,
} from "./ball";
import { PLAY_RIGHT } from "./paddle";

/** Type 6 slots from 0x4141E4. */
export const MAX_MONSTERS = 5;
export const MONSTER_SIZE = 0x20;
/** Row length of monster.gif: addresses are y × 930 + x, [+0x39] (0x403B06). */
export const MONSTER_PITCH = 0x3a2;
/** First frame of the first monster, and one monster further down (0x403A82). */
export const MONSTER_SPRITE = 0x3a3;
export const MONSTER_SPRITE_STRIDE = 0x7f26;
export const MONSTER_FRAMES = 0x10;
export const MONSTER_DELAY = 5;

/** Largest value of rand for x: the room left in the play area (0x403B7F). */
export const MONSTER_X_RANGE = PLAY_RIGHT - MONSTER_SIZE - 0x70;
/** Largest bounce code drawn when something hits a monster (0x403D4F). */
export const MONSTER_BOUNCE_CODES = 0xf;

/** Explosion (0x403BBF): larger than the monster and centred on it. */
export const BLAST_SIZE = 0x46;
export const BLAST_OFFSET = 0x10;
export const BLAST_SPRITE = 0x2003b;
export const BLAST_FRAMES = 0xd;
/** [+0x8D]: the slot is free once 14 anim steps have run (0x406708). */
export const BLAST_STEPS = BLAST_FRAMES + 2;

export interface MonsterSystem {
  /** Slot order; an exploding monster has state −3 like a lost ball. */
  monsters: Ball[];
  /** [0x411049] */
  timer: number;
}

/** 0x40222D empties the slots and 0x403A6F clears the timer, at every round. */
export function createMonsterSystem(): MonsterSystem {
  return { monsters: [], timer: 0 };
}

/** 0x403A6F: the four monsters take turns, one per level. */
export function monsterSprite(level: number): number {
  return ((level - 1) & 3) * MONSTER_SPRITE_STRIDE + MONSTER_SPRITE;
}

function monsterAnim(level: number): SpriteAnim {
  return {
    ...createAnim({
      first: monsterSprite(level),
      w: MONSTER_SIZE,
      h: MONSTER_SIZE,
      step: MONSTER_SIZE + 1,
      frames: MONSTER_FRAMES,
      delay: MONSTER_DELAY,
      countdown: MONSTER_DELAY,
    }),
    left: MONSTER_FRAMES,
  };
}

/**
 * 0x403ADA: the first slot neither in play nor exploding. The timer restarts even
 * with no slot left, and for the add_monster bonus too.
 */
export function spawnMonster(s: MonsterSystem, level: number, rng: Rng): void {
  s.timer = 0;
  let slot = 0;
  while (
    slot < MAX_MONSTERS &&
    (s.monsters[slot]?.state === BallState.Active || s.monsters[slot]?.state === BallState.Lost)
  ) {
    slot++;
  }
  if (slot === MAX_MONSTERS) return;
  s.monsters[slot] = {
    ...createBall(0),
    monster: true,
    w: MONSTER_SIZE,
    h: MONSTER_SIZE,
    dx: 1,
    dy: 1,
    x: rng.rand(MONSTER_X_RANGE) + 0x70,
    y: 0,
    xMax: PLAY_RIGHT - MONSTER_SIZE,
    yMax: SCREEN_BOTTOM - MONSTER_SIZE,
    anim: monsterAnim(level),
  };
}

/** 0x403A93, mode 3. */
export function stepMonsterTimer(
  s: MonsterSystem,
  freqCreateMonster: number,
  level: number,
  rng: Rng,
): void {
  if (++s.timer >= freqCreateMonster) spawnMonster(s, level, rng);
}

/** 0x403BBF: the position may leave the bounds here, clampToBounds brings it back. */
export function explodeMonster(m: Ball): void {
  m.state = BallState.Lost;
  m.dx = 0;
  m.dy = 0;
  m.mode = 0;
  m.x -= BLAST_OFFSET;
  m.y -= BLAST_OFFSET;
  m.w = BLAST_SIZE;
  m.h = BLAST_SIZE;
  m.bouncesOnBricks = false;
  m.xMax = PLAY_RIGHT - BLAST_SIZE;
  m.yMax = SCREEN_BOTTOM - BLAST_SIZE;
  m.dying = BLAST_STEPS;
  m.anim = createAnim({
    first: BLAST_SPRITE,
    w: BLAST_SIZE,
    h: BLAST_SIZE,
    step: BLAST_SIZE + 1,
    frames: BLAST_FRAMES,
    delay: 1,
    countdown: 1,
  });
}

/** 0x403CEE, the routine of del_monster. Returns the monsters blown up, one sound each. */
export function explodeAll(s: MonsterSystem): number {
  let count = 0;
  for (const m of s.monsters) {
    if (m.state !== BallState.Active) continue;
    explodeMonster(m);
    count++;
  }
  return count;
}

/**
 * 0x403CC7 and 0x403D19: the centre of a ball or shot inside a monster, bounds included.
 * The loop goes on after a hit, so one object can take several monsters, and it is
 * deflected each time unless it goes through bricks. Returns the monsters hit.
 */
export function hitMonsters(s: MonsterSystem, ball: Ball, rng: Rng): number {
  const cx = ball.x + (ball.w >> 1);
  const cy = ball.y + (ball.h >> 1);
  let count = 0;
  for (const m of s.monsters) {
    if (m.state !== BallState.Active) continue;
    if (cy < m.y || cy > m.y + m.h || cx < m.x || cx > m.x + m.w) continue;
    if (ball.bouncesOnBricks) applyBounceCode(ball, rng.rand(MONSTER_BOUNCE_CODES));
    explodeMonster(m);
    count++;
  }
  return count;
}

/**
 * 0x403C69: bricks only in mode 3, so in the wait loops of a lost life monsters go
 * through them. The calls to the paddle routines end at 0x4046D0 for type 6, and the
 * check at 0x403CA1 only ever writes the dy = −1 it finds (§4.3): both are left out.
 */
export function updateMonsters(s: MonsterSystem, probe: BrickProbe | null): void {
  for (const m of s.monsters) {
    if (m.state !== BallState.Active) continue;
    wallBounce(m);
    if (probe) brickSweep(m, probe);
    moveBall(m);
  }
}

/** Their part of the stepper 0x4066BA. */
export function stepMonsters(s: MonsterSystem): void {
  for (const m of s.monsters) stepBallAnim(m);
}
