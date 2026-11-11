import { describe, expect, it } from "vitest";
import { Rng } from "../core/rng";
import { spriteAt } from "../render/atlas";
import { type Ball, BallState, type BrickProbe, clampToBounds, createBall, stepBallAnim } from "./ball";
import {
  BLAST_SIZE,
  BLAST_SPRITE,
  MAX_MONSTERS,
  MONSTER_PITCH,
  type MonsterSystem,
  createMonsterSystem,
  explodeAll,
  explodeMonster,
  hitMonsters,
  monsterSprite,
  spawnMonster,
  stepMonsterTimer,
  stepMonsters,
  updateMonsters,
} from "./monsters";

/** Rng returning `values` in turn, recording the bounds it is asked for. */
function rigged(...values: number[]) {
  const asked: number[] = [];
  const rng = {
    rand(n: number) {
      asked.push(n);
      return values.shift() ?? 0;
    },
  } as unknown as Rng;
  return { rng, asked };
}

const noBricks: BrickProbe = { hit: () => false };

function oneMonster(x = 200, y = 100): { s: MonsterSystem; m: Ball } {
  const s = createMonsterSystem();
  spawnMonster(s, 1, new Rng(1));
  const m = s.monsters[0]!;
  m.x = x;
  m.y = y;
  return { s, m };
}

/** A 9 × 9 ball with its centre at (cx, cy). */
function ballAt(cx: number, cy: number): Ball {
  return { ...createBall(0), x: cx - 4, y: cy - 4, dx: 3, dy: -4 };
}

describe("spawn (0x403ADA)", () => {
  it("starts at the top, going down right at 1 px per tick", () => {
    const { rng, asked } = rigged(50);
    const s = createMonsterSystem();
    spawnMonster(s, 1, rng);
    const m = s.monsters[0]!;
    expect(asked).toEqual([384]);
    expect(m).toMatchObject({
      x: 162,
      y: 0,
      dx: 1,
      dy: 1,
      w: 32,
      h: 32,
      mode: 0,
      state: BallState.Active,
      monster: true,
      bouncesOnBricks: true,
      xMin: 112,
      xMax: 496,
      yMin: 0,
      yMax: 448,
    });
  });

  it("uses the whole width of the play area", () => {
    for (const [value, x] of [
      [0, 112],
      [384, 496],
    ] as const) {
      const s = createMonsterSystem();
      spawnMonster(s, 1, rigged(value).rng);
      expect(s.monsters[0]!.x).toBe(x);
    }
  });

  it("alternates the four monsters by level (0x403A6F)", () => {
    const row = (level: number) => spriteAt(monsterSprite(level), 32, 32, MONSTER_PITCH);
    expect(row(1)).toEqual({ x: 1, y: 1, w: 32, h: 32 });
    expect(row(2).y).toBe(36);
    expect(row(3).y).toBe(71);
    expect(row(4).y).toBe(106);
    expect(row(5)).toEqual(row(1));
  });

  it("takes the first slot neither in play nor exploding, among 5", () => {
    const rng = new Rng(1);
    const s = createMonsterSystem();
    for (let i = 0; i < MAX_MONSTERS + 1; i++) spawnMonster(s, 1, rng);
    expect(s.monsters).toHaveLength(MAX_MONSTERS);

    const [first, second] = s.monsters;
    explodeMonster(first!);
    second!.state = BallState.Dead;
    spawnMonster(s, 1, rng);
    expect(s.monsters[0]).toBe(first);
    expect(s.monsters[1]).not.toBe(second);
    expect(s.monsters[1]!.state).toBe(BallState.Active);
  });

  it("draws no x when no slot is left", () => {
    const s = createMonsterSystem();
    for (let i = 0; i < MAX_MONSTERS; i++) spawnMonster(s, 1, new Rng(1));
    const { rng, asked } = rigged();
    spawnMonster(s, 1, rng);
    expect(asked).toEqual([]);
  });
});

describe("spawn timer (0x403A93)", () => {
  it("spawns on the tick the counter reaches the frequency, then restarts", () => {
    const s = createMonsterSystem();
    const rng = new Rng(1);
    stepMonsterTimer(s, 3, 1, rng);
    stepMonsterTimer(s, 3, 1, rng);
    expect(s.monsters).toHaveLength(0);
    stepMonsterTimer(s, 3, 1, rng);
    expect(s.monsters).toHaveLength(1);
    expect(s.timer).toBe(0);
  });

  it("restarts even with all slots taken", () => {
    const s = createMonsterSystem();
    const rng = new Rng(1);
    for (let i = 0; i < MAX_MONSTERS; i++) spawnMonster(s, 1, rng);
    s.timer = 2;
    stepMonsterTimer(s, 3, 1, rng);
    expect(s.timer).toBe(0);
  });

  it("is restarted by a direct spawn too", () => {
    const s = createMonsterSystem();
    s.timer = 2;
    spawnMonster(s, 1, new Rng(1));
    expect(s.timer).toBe(0);
  });
});

describe("movement (0x403C69)", () => {
  it("moves 1 px per tick", () => {
    const { s, m } = oneMonster();
    updateMonsters(s, noBricks);
    expect([m.x, m.y]).toEqual([201, 101]);
  });

  it("bounces on the 4 bounds, the bottom included", () => {
    const cases: [number, number, number, number, "dx" | "dy"][] = [
      [495, 100, 1, 1, "dx"],
      [113, 100, -1, 1, "dx"],
      [200, 447, 1, 1, "dy"],
      [200, 1, 1, -1, "dy"],
    ];
    for (const [x, y, dx, dy, axis] of cases) {
      const { s, m } = oneMonster(x, y);
      m.dx = dx;
      m.dy = dy;
      const before = m[axis];
      updateMonsters(s, noBricks);
      expect(m[axis]).toBe(-before);
    }
  });

  it("never gets the anti-loop guard (0x4051EC)", () => {
    const { s, m } = oneMonster(200, 447);
    const start = { dx: m.dx, mode: m.mode };
    for (let i = 0; i < 200; i++) {
      m.y = 447;
      m.dy = 1;
      updateMonsters(s, noBricks);
    }
    expect(m.mode).toBe(start.mode);
    expect(m.loopCount).toBe(0);
    expect(Math.abs(m.dx)).toBe(start.dx);
  });

  it("bounces off bricks in mode 3 and goes through them otherwise", () => {
    const solid: BrickProbe = { hit: (_x, y) => y >= 133 };
    const a = oneMonster(200, 100);
    updateMonsters(a.s, solid);
    expect(a.m.dy).toBe(-1);

    const b = oneMonster(200, 100);
    updateMonsters(b.s, null);
    expect(b.m.dy).toBe(1);
    expect(b.m.y).toBe(101);
  });

  it("skips free and exploding slots", () => {
    const { s, m } = oneMonster();
    explodeMonster(m);
    const { x, y } = m;
    updateMonsters(s, noBricks);
    expect([m.x, m.y]).toEqual([x, y]);
  });

  it("stays pinned at the top while a brick is under its back corner (0x406874)", () => {
    const { s, m } = oneMonster(200, 0);
    // Bricks on row 2, up to x = 239.
    const row2: BrickProbe = { hit: (x, y) => y >= 32 && y < 48 && x < 240 };
    const ys: number[] = [];
    while (m.x < 239) {
      updateMonsters(s, row2);
      // The value 0x403CA1 would force is what dy already holds whenever y <= 0.
      if (m.y <= 0) expect(m.dy).toBe(-1);
      clampToBounds(m);
      ys.push(m.y);
    }
    expect(new Set(ys)).toEqual(new Set([0]));
    updateMonsters(s, row2);
    clampToBounds(m);
    expect(m.dy).toBe(1);
    expect(m.y).toBe(1);
  });
});

describe("animation (0x4066BA)", () => {
  it("advances one frame of 33 px every 6 ticks and wraps after 16", () => {
    const { s, m } = oneMonster();
    const first = m.anim.first;
    for (let i = 0; i < 5; i++) stepMonsters(s);
    expect(m.anim.frame).toBe(first);
    stepMonsters(s);
    expect(m.anim.frame).toBe(first + 33);
    for (let i = 0; i < 6 * 14; i++) stepMonsters(s);
    expect(m.anim.frame).toBe(first + 33 * 15);
    for (let i = 0; i < 6; i++) stepMonsters(s);
    expect(m.anim.frame).toBe(first);
  });
});

describe("explosion (0x403BBF)", () => {
  it("stops, grows to 70 × 70 and moves 16 px up and left", () => {
    const { m } = oneMonster(200, 100);
    explodeMonster(m);
    expect(m).toMatchObject({
      state: BallState.Lost,
      dx: 0,
      dy: 0,
      x: 184,
      y: 84,
      w: BLAST_SIZE,
      h: BLAST_SIZE,
      xMin: 112,
      xMax: 458,
      yMin: 0,
      yMax: 410,
    });
    expect(spriteAt(BLAST_SPRITE, 70, 70, MONSTER_PITCH)).toEqual({ x: 1, y: 141, w: 70, h: 70 });
  });

  it("stays inside the play area once clamped", () => {
    for (const [x, y, ex, ey] of [
      [112, 1, 112, 0],
      [496, 448, 458, 410],
    ] as const) {
      const { m } = oneMonster(x, y);
      explodeMonster(m);
      clampToBounds(m);
      expect([m.x, m.y]).toEqual([ex, ey]);
    }
  });

  it("is visible 27 ticks and shows its 13 frames", () => {
    const { m } = oneMonster();
    explodeMonster(m);
    const frames: number[] = [];
    let visible = 0;
    for (;;) {
      stepBallAnim(m);
      if (m.state === BallState.Dead) break;
      frames.push(m.anim.frame);
      visible++;
    }
    expect(visible).toBe(27);
    expect(new Set(frames).size).toBe(13);
    expect(frames[0]).toBe(BLAST_SPRITE);
    expect(frames.slice(0, 3)).toEqual([BLAST_SPRITE, BLAST_SPRITE, BLAST_SPRITE]);
    expect(frames[3]).toBe(BLAST_SPRITE + 71);
    expect(frames[26]).toBe(BLAST_SPRITE + 71 * 12);
  });
});

describe("explodeAll (0x403CEE)", () => {
  it("blows up the monsters in play only and counts them", () => {
    const s = createMonsterSystem();
    const rng = new Rng(1);
    for (let i = 0; i < 3; i++) spawnMonster(s, 1, rng);
    explodeMonster(s.monsters[1]!);
    const { x } = s.monsters[1]!;
    expect(explodeAll(s)).toBe(2);
    expect(s.monsters.every((m) => m.state === BallState.Lost)).toBe(true);
    // Not exploded twice.
    expect(s.monsters[1]!.x).toBe(x);
  });
});

describe("hits (0x403D19)", () => {
  it("tests the centre of the object, bounds included", () => {
    const inside = [
      [200, 100],
      [232, 132],
    ];
    for (const [cx, cy] of inside) {
      const { s, m } = oneMonster(200, 100);
      expect(hitMonsters(s, ballAt(cx!, cy!), new Rng(1))).toBe(1);
      expect(m.state).toBe(BallState.Lost);
    }
    const outside = [
      [199, 110],
      [233, 110],
      [210, 99],
      [210, 133],
    ];
    for (const [cx, cy] of outside) {
      const { s, m } = oneMonster(200, 100);
      expect(hitMonsters(s, ballAt(cx!, cy!), new Rng(1))).toBe(0);
      expect(m.state).toBe(BallState.Active);
    }
  });

  it("uses the half size of the object, rounded down", () => {
    const { s } = oneMonster(200, 100);
    // A big shot: 8 × 42, centre at +4, +21.
    const shot: Ball = { ...createBall(0), shot: true, w: 8, h: 42, x: 196, y: 79 };
    expect(hitMonsters(s, shot, new Rng(1))).toBe(1);
  });

  it("deflects a ball by a random bounce code of 0 to 15 (0x40436A)", () => {
    const cases: [number, number, number][] = [
      [0, 3, -4],
      [1, -3, -4],
      [2, 3, 4],
      [3, -3, 4],
    ];
    for (const [code, dx, dy] of cases) {
      const { s } = oneMonster(200, 100);
      const b = ballAt(210, 110);
      const { rng, asked } = rigged(code);
      hitMonsters(s, b, rng);
      expect(asked).toEqual([15]);
      expect([b.dx, b.dy]).toEqual([dx, dy]);
    }
  });

  it("does not deflect a ball going through bricks, and draws nothing", () => {
    const { s, m } = oneMonster(200, 100);
    const b = { ...ballAt(210, 110), bouncesOnBricks: false };
    const { rng, asked } = rigged();
    expect(hitMonsters(s, b, rng)).toBe(1);
    expect([b.dx, b.dy]).toEqual([3, -4]);
    expect(asked).toEqual([]);
    expect(m.state).toBe(BallState.Lost);
  });

  it("removes a mini shot, except on code 0 (0x4043CB)", () => {
    const shot = () => ({ ...ballAt(210, 110), shot: true });
    const a = oneMonster(200, 100);
    const killed = shot();
    hitMonsters(a.s, killed, rigged(7).rng);
    expect(killed.state).toBe(BallState.Dead);
    expect(a.m.state).toBe(BallState.Lost);

    const b = oneMonster(200, 100);
    const kept = shot();
    hitMonsters(b.s, kept, rigged(0).rng);
    expect(kept.state).toBe(BallState.Active);
    expect(b.m.state).toBe(BallState.Lost);
  });

  it("goes on after a hit: one object can take two monsters, deflected twice", () => {
    const s = createMonsterSystem();
    const rng = new Rng(1);
    spawnMonster(s, 1, rng);
    spawnMonster(s, 1, rng);
    for (const m of s.monsters) {
      m.x = 200;
      m.y = 100;
    }
    const b = ballAt(210, 110);
    expect(hitMonsters(s, b, rigged(1, 1).rng)).toBe(2);
    expect(b.dx).toBe(3);
  });

  it("ignores an explosion", () => {
    const { s, m } = oneMonster(200, 100);
    explodeMonster(m);
    expect(hitMonsters(s, ballAt(210, 110), new Rng(1))).toBe(0);
  });
});
