import { describe, expect, it } from "vitest";
import { Rng } from "../core/rng";
import { BONUS_KEYS, Difficulty, type GameConfig, type Triplet } from "../data/config";
import {
  BONUSES,
  BONUS_TICKS,
  CapsuleState,
  FLASH_CYCLES,
  MAX_CAPSULES,
  MESSAGE_END_TICKS,
  bonusByKey,
  catchBonus,
  catchCapsules,
  clearActive,
  createActiveBonus,
  createBonusDraw,
  createCapsules,
  createIconFlash,
  drawBonus,
  spawnCapsule,
  stepBonusTimer,
  stepIconFlash,
  updateCapsules,
} from "./bonus";
import { createPaddle } from "./paddle";

/** Plays back fixed values; rand(n) records the n it was asked for. */
class ScriptedRng extends Rng {
  readonly asked: number[] = [];
  constructor(private readonly values: number[]) {
    super(0);
  }
  override rand(n: number): number {
    this.asked.push(n);
    return this.values.shift() ?? 0;
  }
}

const allFreq = (v: number) =>
  Object.fromEntries(BONUS_KEYS.map((k) => [k, [v, v, v] as Triplet])) as GameConfig["bonusFreq"];

const config = (freq = 1): Pick<GameConfig, "timeBetweenOption" | "bonusFreq"> => ({
  timeBetweenOption: [6, 10, 12],
  bonusFreq: allFreq(freq),
});

const ready = (last = 0) => ({ ticks: 100, last });

describe("bonus table (0x4125D4)", () => {
  it("has 24 entries whose code is the sprite address", () => {
    expect(BONUSES).toHaveLength(24);
    expect(bonusByKey("3_ball").code).toBe(0x75801);
    expect(bonusByKey("next_level").code).toBe(0x75987);
    expect(bonusByKey("fast_ball").code).toBe(0x758d1);
    expect(bonusByKey("collision").code).toBe(0x75a57);
  });

  it("swaps the sprites of +100 and −100", () => {
    expect(bonusByKey("bonus").code).toBe(0x75a23);
    expect(bonusByKey("malus").code).toBe(0x75a09);
  });

  it("disables collision only", () => {
    expect(BONUSES.filter((b) => !b.enabled).map((b) => b.key)).toEqual(["collision"]);
  });

  it("drops collision with two players only (0x4052FC)", () => {
    const solo = drawBonus(ready(), config(), Difficulty.Easy, new ScriptedRng([23]));
    expect(solo).toBeNull();
    const two = drawBonus(ready(), config(), Difficulty.Easy, new ScriptedRng([23]), true);
    expect(two?.key).toBe("collision");
  });
});

describe("two players (§4.6)", () => {
  it("tests player 1's paddle first, then player 2's (0x40551D)", () => {
    const p1 = { x: 300, w: 74 };
    const p2 = { x: 150, w: 74 };
    const caps = createCapsules();
    spawnCapsule(caps, bonusByKey("bonus"), 300, 414);
    spawnCapsule(caps, bonusByKey("malus"), 150, 414);
    spawnCapsule(caps, bonusByKey("night"), 30, 414);
    expect(catchCapsules(caps, [p1, p2], true).map((c) => [c.bonus.key, c.seat])).toEqual([
      ["bonus", 0],
      ["malus", 1],
    ]);
  });

  it("puts a bonus in the catcher's slot only, and clears both slots together", () => {
    const state = createActiveBonus();
    catchBonus(state, bonusByKey("large_ship"), 0);
    catchBonus(state, bonusByKey("shoot"), 1);
    expect(state.active?.key).toBe("shoot");
    expect(state.seats.map((b) => b?.key)).toEqual(["large_ship", "shoot"]);
    expect(state.picker).toBe(1);
    clearActive(state);
    expect(state.seats).toEqual([null, null]);
  });

  it("empties both slots when the timer runs out (0x405E6A)", () => {
    const state = createActiveBonus();
    catchBonus(state, bonusByKey("large_ship"), 1);
    state.timer = 1;
    expect(stepBonusTimer(state)).toBe("expired");
    expect(state.seats).toEqual([null, null]);
  });
});

describe("drawBonus (0x40531A)", () => {
  it("does nothing before Time_Between_Option ticks, per difficulty", () => {
    const draw = { ticks: 9, last: 0 };
    expect(drawBonus(draw, config(), Difficulty.Medium, new ScriptedRng([5]))).toBeNull();
    expect(draw.ticks).toBe(9);
    draw.ticks = 10;
    expect(drawBonus(draw, config(), Difficulty.Medium, new ScriptedRng([5]))?.key).toBe(
      "new_life",
    );
    expect(draw.ticks).toBe(0);
  });

  it("starts with bonus 0 as the last one", () => {
    expect(createBonusDraw()).toEqual({ ticks: 0, last: 0 });
  });

  it("draws in 0..23 and never the same bonus twice in a row", () => {
    const rng = new ScriptedRng([3, 3, 7]);
    const draw = ready(3);
    expect(drawBonus(draw, config(), Difficulty.Easy, rng)?.key).toBe("slow_ball");
    expect(rng.asked).toEqual([23, 23, 23]);
    expect(draw.last).toBe(7);
  });

  it("drops nothing on a disabled bonus, but remembers it", () => {
    const draw = ready();
    expect(drawBonus(draw, config(), Difficulty.Easy, new ScriptedRng([23]))).toBeNull();
    expect(draw.last).toBe(23);
  });

  it("draws again when the frequency is 0", () => {
    const c = config();
    const freq = { ...c.bonusFreq, death: [0, 0, 0] as Triplet };
    const rng = new ScriptedRng([4, 5]);
    expect(drawBonus(ready(), { ...c, bonusFreq: freq }, Difficulty.Easy, rng)?.key).toBe(
      "new_life",
    );
  });

  it("drops with probability 1/f", () => {
    const hit = new ScriptedRng([5, 0]);
    expect(drawBonus(ready(), config(4), Difficulty.Easy, hit)?.key).toBe("new_life");
    expect(hit.asked).toEqual([23, 3]);
    const miss = new ScriptedRng([5, 1]);
    expect(drawBonus(ready(), config(4), Difficulty.Easy, miss)).toBeNull();
  });

  it("uses no second number when the frequency is 1", () => {
    const rng = new ScriptedRng([5]);
    drawBonus(ready(), config(1), Difficulty.Easy, rng);
    expect(rng.asked).toEqual([23]);
  });
});

describe("capsules", () => {
  const def = bonusByKey("bonus");

  it("has 8 slots and reuses any slot not falling (0x4053D4)", () => {
    const caps = createCapsules();
    expect(caps).toHaveLength(MAX_CAPSULES);
    caps[0]!.state = CapsuleState.Falling;
    caps[1]!.state = CapsuleState.Gone;
    expect(spawnCapsule(caps, def, 144, 32)).toBe(true);
    expect(caps[1]).toMatchObject({ x: 144, y: 32, state: CapsuleState.Falling, bonus: def });
  });

  it("loses the capsule when all slots are falling", () => {
    const caps = createCapsules();
    for (const c of caps) c.state = CapsuleState.Falling;
    expect(spawnCapsule(caps, def, 0, 0)).toBe(false);
  });

  it("falls 2 px per tick (0x40541D)", () => {
    const caps = createCapsules();
    spawnCapsule(caps, def, 144, 32);
    updateCapsules(caps, createPaddle(), true);
    expect(caps[0]!.y).toBe(34);
  });

  const falling = (x: number, y: number) => {
    const caps = createCapsules();
    spawnCapsule(caps, def, x, y);
    return caps;
  };

  it("is caught from y 416 to 440, inside the paddle's width (0x4054E7)", () => {
    const p = createPaddle();
    expect(updateCapsules(falling(p.x, 412), p, true)).toEqual([]);
    expect(updateCapsules(falling(p.x, 414), p, true)).toEqual([def]);
    expect(updateCapsules(falling(p.x, 438), p, true)).toEqual([def]);
    expect(updateCapsules(falling(p.x, 440), p, true)).toEqual([]);
  });

  it("is not caught when it sticks out of the paddle", () => {
    const p = createPaddle();
    expect(updateCapsules(falling(p.x + p.w - 26, 414), p, true)).toEqual([def]);
    expect(updateCapsules(falling(p.x + p.w - 25, 414), p, true)).toEqual([]);
    expect(updateCapsules(falling(p.x - 1, 414), p, true)).toEqual([]);
  });

  it("is only caught in mode 3 (0x4054D2)", () => {
    const p = createPaddle();
    const caps = falling(p.x, 414);
    expect(updateCapsules(caps, p, false)).toEqual([]);
    expect(caps[0]!.state).toBe(CapsuleState.Falling);
  });

  it("frees the slot on a catch", () => {
    const p = createPaddle();
    const caps = falling(p.x, 414);
    updateCapsules(caps, p, true);
    expect(caps[0]!.state).toBe(CapsuleState.Gone);
  });

  it("is lost once y + 24 + 2 reaches the screen bottom (0x40548C)", () => {
    const p = createPaddle();
    const caps = falling(112, 450);
    updateCapsules(caps, p, true);
    expect(caps[0]!.state).toBe(CapsuleState.Falling);
    updateCapsules(caps, p, true);
    expect(caps[0]).toMatchObject({ y: 454, state: CapsuleState.Gone });
  });
});

describe("active bonus (0x4055AE, 0x405E1A)", () => {
  it("keeps one bonus, remembers the previous, runs 600 ticks", () => {
    const s = createActiveBonus();
    catchBonus(s, bonusByKey("slow_ball"));
    catchBonus(s, bonusByKey("fast_ball"));
    expect(s.active?.key).toBe("fast_ball");
    expect(s.previous?.key).toBe("slow_ball");
    expect(s.timer).toBe(BONUS_TICKS);
    expect(BONUS_TICKS).toBe(600);
    expect(s.icon).toBe(0x758d1);
  });

  it("does nothing while the timer is 0", () => {
    const s = createActiveBonus();
    expect(stepBonusTimer(s)).toBe("none");
    expect(s.timer).toBe(0);
  });

  it("blanks the message at 500, and drops the icon of an instant bonus", () => {
    const s = createActiveBonus();
    catchBonus(s, bonusByKey("bonus"));
    s.active = null;
    s.label = "bonus";
    s.timer = MESSAGE_END_TICKS + 1;
    expect(stepBonusTimer(s)).toBe("messageEnd");
    expect(s.icon).toBeNull();
    expect(s.label).toBeNull();
  });

  it("keeps the icon of a lasting bonus at 500", () => {
    const s = createActiveBonus();
    catchBonus(s, bonusByKey("slow_ball"));
    s.timer = MESSAGE_END_TICKS + 1;
    expect(stepBonusTimer(s)).toBe("messageEnd");
    expect(s.icon).toBe(0x758b7);
  });

  it("expires at 0, even after an instant bonus (0x405E58)", () => {
    const s = createActiveBonus();
    catchBonus(s, bonusByKey("slow_ball"));
    s.timer = 1;
    expect(stepBonusTimer(s)).toBe("expired");
    expect(s).toMatchObject({ active: null, icon: null, label: null, timer: 0 });
    const instant = createActiveBonus();
    instant.timer = 1;
    expect(stepBonusTimer(instant)).toBe("expired");
  });
});

describe("icon flash (0x405671)", () => {
  it("shows steps 0..11 then 12..1, 10 times, one per tick", () => {
    const f = createIconFlash();
    f.on = true;
    const shown: number[] = [];
    for (let i = 0; i < 24; i++) {
      stepIconFlash(f);
      shown.push(f.shown);
    }
    const down = Array.from({ length: 12 }, (_, i) => i);
    const up = Array.from({ length: 12 }, (_, i) => 12 - i);
    expect(shown).toEqual([...down, ...up]);
    expect(f.cycles).toBe(1);
  });

  it("stops after 240 ticks on step 1", () => {
    const f = createIconFlash();
    f.on = true;
    for (let i = 0; i < 24 * FLASH_CYCLES - 1; i++) stepIconFlash(f);
    expect(f.on).toBe(true);
    stepIconFlash(f);
    expect(f).toMatchObject({ on: false, shown: 1, step: 0, darker: true, cycles: 0 });
  });

  it("does nothing while off", () => {
    const f = createIconFlash();
    stepIconFlash(f);
    expect(f.shown).toBe(0);
    expect(f.step).toBe(0);
  });
});
