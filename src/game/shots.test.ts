import { describe, expect, it } from "vitest";
import { BallState, type BrickProbe } from "./ball";
import { PADDLE_LARGE, PADDLE_SMALL, createPaddle, setPaddleSize } from "./paddle";
import {
  BIG_CANNON_TICKS,
  MAX_SHOTS,
  MINI_CANNON_TICKS,
  type ShotSystem,
  createShotSystem,
  hideCannons,
  placeCannons,
  resetShotSystem,
  setupBigCannon,
  setupMiniCannons,
  stepShotSystem,
  updateCannons,
  updateShots,
} from "./shots";

const noBricks: BrickProbe = { hit: () => false };

function mini(s: ShotSystem, fire = false) {
  setupMiniCannons(s);
  return updateCannons(s, "mini_shoot", fire, createPaddle());
}

function big(s: ShotSystem, fire = false) {
  setupBigCannon(s);
  return updateCannons(s, "shoot", fire, createPaddle());
}

describe("cannons (0x402828, 0x4060BD, 0x406195)", () => {
  it("shows both mini cannons while mini_shoot is active, and hides the big one", () => {
    const s = createShotSystem();
    big(s);
    expect(s.big.on).toBe(true);
    mini(s);
    expect([s.miniLeft.on, s.miniRight.on, s.big.on]).toEqual([true, true, false]);
    expect(s.bigReady).toBe(false);
    big(s);
    expect([s.miniLeft.on, s.miniRight.on, s.big.on]).toEqual([false, false, true]);
    expect(s.miniReady).toBe(false);
  });

  it("clears both and the latch when neither bonus is active", () => {
    const s = createShotSystem();
    mini(s, true);
    expect(s.latch).toBe(true);
    expect(updateCannons(s, null, true, createPaddle())).toBeNull();
    expect([s.miniLeft.on, s.miniRight.on, s.miniReady, s.latch]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it("sets each cannon up once while its flag is off", () => {
    const s = createShotSystem();
    setupMiniCannons(s);
    expect(s.miniLeft.anim).toMatchObject({ frames: 6, left: 6, delay: 1, countdown: 1 });
    expect(s.miniRight.anim.frame).toBe(0x1cb12);
    expect(s.miniLeft.freeze).toBe(MINI_CANNON_TICKS);
    s.miniLeft.freeze = 3;
    setupMiniCannons(s);
    expect(s.miniLeft.freeze).toBe(3);
    setupBigCannon(s);
    expect(s.big.anim).toMatchObject({ frames: 4, left: 1, frame: 0x40a3e, delay: 1 });
    expect(s.big.freeze).toBe(BIG_CANNON_TICKS);
  });

  it("freezes a cannon by dropping its frames to 1 when its countdown ends", () => {
    const s = createShotSystem();
    for (let i = 0; i < BIG_CANNON_TICKS - 1; i++) {
      big(s);
      stepShotSystem(s);
    }
    expect(s.big.anim.frames).toBe(4);
    big(s);
    expect(s.big.anim.frames).toBe(1);
    const { frame } = s.big.anim;
    for (let i = 0; i < 20; i++) stepShotSystem(s);
    expect(s.big.anim.frame).toBe(frame);
  });

  it("steps the big cannon by width + 1 and the mini ones 37 rows down", () => {
    const s = createShotSystem();
    mini(s);
    expect(s.miniLeft.anim.step).toBe(0x5c80);
    expect(s.miniLeft.anim.step % 640).toBe(0);
    expect(s.big.anim.step).toBe(0xe);
  });

  it("only animates the cannons on screen", () => {
    const s = createShotSystem();
    setupBigCannon(s);
    hideCannons(s);
    const { countdown } = s.big.anim;
    stepShotSystem(s);
    expect(s.big.anim.countdown).toBe(countdown);
  });

  it("follows the paddle at its offsets (0x406E2A)", () => {
    const s = createShotSystem();
    const p = createPaddle();
    p.x = 200;
    placeCannons(s, p);
    expect([s.miniLeft.x, s.miniLeft.y]).toEqual([207, 409]);
    expect([s.miniRight.x, s.miniRight.y]).toEqual([255, 409]);
    expect([s.big.x, s.big.y]).toEqual([231, 408]);
  });

  it("keeps the cannons inside their 9 px bounds of 0x40222D (0x40687F)", () => {
    const s = createShotSystem();
    const p = createPaddle();
    setPaddleSize(p, PADDLE_SMALL);
    p.x = 528 - 38;
    placeCannons(s, p);
    expect(s.miniRight.x).toBe(519);
    expect(s.big.x).toBe(519);
    expect(s.miniLeft.x).toBe(497);
  });

  it("is reset at the start of a round, except the latch and the side", () => {
    const s = createShotSystem();
    mini(s, true);
    const r = resetShotSystem(s);
    expect(r.shots).toEqual([]);
    expect([r.miniLeft.on, r.miniReady]).toEqual([false, false]);
    expect([r.latch, r.leftNext]).toEqual([true, true]);
  });
});

describe("firing (0x4028E3)", () => {
  it("needs the button released between two shots", () => {
    const s = createShotSystem();
    expect(mini(s, true)).toBe("mini_shoot");
    expect(mini(s, true)).toBeNull();
    expect(s.shots).toHaveLength(1);
    expect(mini(s, false)).toBeNull();
    expect(s.latch).toBe(false);
    expect(mini(s, true)).toBe("mini_shoot");
    expect(s.shots).toHaveLength(2);
  });

  it("fires a big shot centred on the paddle, through the bricks (0x402982)", () => {
    const s = createShotSystem();
    const p = createPaddle();
    setPaddleSize(p, PADDLE_LARGE);
    p.x = 200;
    setupBigCannon(s);
    expect(updateCannons(s, "shoot", true, p)).toBe("shoot");
    expect(s.shots[0]).toMatchObject({
      w: 8,
      h: 0x2a,
      x: 200 + 48,
      y: 416 - 0x12,
      dx: 0,
      dy: -4,
      mode: 0,
      bouncesOnBricks: false,
      state: BallState.Active,
      xMin: 0x70,
      xMax: 0x210 - 8,
      yMin: 0,
      yMax: 0x1e0 - 0x2a,
      shot: true,
    });
    expect(s.shots[0]!.anim).toMatchObject({
      first: 0x3513c,
      frame: 0x3513c,
      frames: 0xb,
      left: 0xb,
      delay: 5,
      countdown: 5,
      step: 11,
    });
  });

  it("alternates the mini shots and replays the cannon of that side (0x402A70)", () => {
    const s = createShotSystem();
    mini(s);
    mini(s, true);
    const first = s.shots[0]!;
    expect(first).toMatchObject({ w: 3, h: 0xd, x: 283 + 7, bouncesOnBricks: true });
    expect(first.anim).toMatchObject({ first: 0x19a55, frames: 1 });
    expect(s.miniLeft.anim).toMatchObject({ frames: 6, left: 1, frame: 0x1caf6 });
    expect(s.miniLeft.freeze).toBe(MINI_CANNON_TICKS);
    mini(s);
    mini(s, true);
    expect(s.shots[1]!.x).toBe(283 + 0x3d);
    expect(s.miniRight.anim).toMatchObject({ frames: 6, left: 1, frame: 0x1cb12 });
    mini(s);
    mini(s, true);
    expect(s.shots[2]!.x).toBe(283 + 7);
  });

  it("reuses free slots, and drops the shot with all 20 taken", () => {
    const s = createShotSystem();
    for (let i = 0; i < MAX_SHOTS; i++) {
      mini(s, true);
      mini(s, false);
    }
    expect(s.shots).toHaveLength(MAX_SHOTS);
    expect(mini(s, true)).toBeNull();
    expect(s.latch).toBe(false);
    s.shots[4]!.state = BallState.Dead;
    const dead = s.shots[4];
    expect(mini(s, true)).toBe("mini_shoot");
    expect(s.shots[4]).not.toBe(dead);
    expect(s.shots[4]!.state).toBe(BallState.Active);
  });
});

describe("shots in flight (0x403A39)", () => {
  function fired() {
    const s = createShotSystem();
    mini(s, true);
    return { s, shot: s.shots[0]! };
  }

  it("climb 4 px per tick", () => {
    const { s, shot } = fired();
    updateShots(s, noBricks);
    expect(shot.y).toBe(398 - 4);
  });

  it("vanish past the top instead of bouncing, and still sweep and move that tick", () => {
    const { s, shot } = fired();
    shot.y = 3;
    let probed = 0;
    updateShots(s, {
      hit: () => {
        probed++;
        return false;
      },
    });
    expect(shot.state).toBe(BallState.Dead);
    expect(shot.dy).toBe(-4);
    expect(shot.y).toBe(-1);
    expect(probed).toBeGreaterThan(0);
    updateShots(s, noBricks);
    expect(shot.y).toBe(-1);
  });

  it("vanish on a side bound too (0x404037)", () => {
    const { s, shot } = fired();
    shot.dx = -4;
    shot.x = 0x70 + 2;
    updateShots(s, noBricks);
    expect(shot.state).toBe(BallState.Dead);
    expect(shot.dx).toBe(-4);
  });

  it("mini shots vanish on the first brick hit (0x4043CB)", () => {
    const { s, shot } = fired();
    updateShots(s, { hit: () => true });
    expect(shot.state).toBe(BallState.Dead);
    expect(shot.dy).toBe(-4);
  });

  it("big shots go through bricks", () => {
    const s = createShotSystem();
    big(s, true);
    const shot = s.shots[0]!;
    updateShots(s, { hit: () => true });
    expect(shot.state).toBe(BallState.Active);
  });

  it("skip the bricks with no probe, in the wait loops", () => {
    const { s, shot } = fired();
    updateShots(s, null);
    expect(shot.state).toBe(BallState.Active);
    expect(shot.y).toBe(398 - 4);
  });

  it("animate the big shot over its 11 frames, every 6 ticks (0x4066BA)", () => {
    const s = createShotSystem();
    big(s, true);
    const shot = s.shots[0]!;
    for (let i = 0; i < 5; i++) stepShotSystem(s);
    expect(shot.anim.frame).toBe(0x3513c);
    stepShotSystem(s);
    expect(shot.anim.frame).toBe(0x3513c + 11);
  });
});

describe("monster test of a shot (0x403A5C)", () => {
  function fired() {
    const s = createShotSystem();
    mini(s, true);
    return { s, shot: s.shots[0]! };
  }

  it("runs only with the bricks, in mode 3", () => {
    const { s } = fired();
    let calls = 0;
    updateShots(s, null, () => calls++);
    expect(calls).toBe(0);
    updateShots(s, noBricks, () => calls++);
    expect(calls).toBe(1);
  });

  it("still runs for a shot that just left or hit a brick, then it moves", () => {
    const { s, shot } = fired();
    shot.y = 3;
    let seen: number[] = [];
    updateShots(s, noBricks, (b) => {
      seen = [b.state, b.y];
    });
    expect(seen).toEqual([BallState.Dead, 3]);
    expect(shot.y).toBe(-1);
  });
});
