import { describe, expect, it } from "vitest";
import { WORLDS } from "../data/images";
import {
  ARRIVAL,
  PaddleSprite,
  createAnim,
  explosionOf,
  stepAnim,
  warpOf,
} from "../game/animation";
import { createBall, ghostContact, makeGhosts, makeIron } from "../game/ball";
import { PADDLE_LARGE, PADDLE_NORMAL, PADDLE_SMALL } from "../game/paddle";
import { LIFE_ICONS, capsuleSprite } from "./atlas";
import { livesSprite } from "./hud";
import {
  type PlayerSkin,
  skinnedCapsule,
  skinnedFrame,
  skinnedLifeIcons,
  worldPlayerSkin,
} from "./skin";

const shown = (first: number, skin: PlayerSkin = "player2") =>
  skinnedFrame({ first, frame: first }, skin);
const { Large, Normal, Small } = PaddleSprite;

function ghostBall() {
  const ball = createBall(100);
  makeGhosts([createBall(100), ball]);
  return ball;
}

describe("skin choice", () => {
  it("gives the player 2 colours to Limbes only", () => {
    expect(WORLDS.map((w) => [w, worldPlayerSkin(w)])).toEqual([
      ["space", "player1"],
      ["arcade", "player1"],
      ["limbes", "player2"],
    ]);
  });
});

describe("player 2 frames", () => {
  it("maps the three paddles (0x4030F4, 0x4032CC)", () => {
    expect(shown(Normal)).toBe(0xaa00);
    expect(shown(Large)).toBe(0xab28);
    expect(shown(Small)).toBe(0xabfa);
  });

  it("maps the explosions (0x4030DC..0x403162)", () => {
    expect(shown(explosionOf(Normal).spec.first)).toBe(0x89081);
    expect(shown(explosionOf(Large).spec.first)).toBe(0x89155);
    expect(shown(explosionOf(Small).spec.first)).toBe(0x890f8);
  });

  it("maps the warps (0x4032B4..0x40333A) and the arrival (0x40329D)", () => {
    expect(shown(warpOf(Normal).spec.first)).toBe(0xcdde5);
    expect(shown(warpOf(Large).spec.first)).toBe(0xe1d01);
    expect(shown(warpOf(Small).spec.first)).toBe(0xcde9f);
    expect(shown(ARRIVAL.spec.first)).toBe(0xcde42);
  });

  it("keeps a frame's offset in its strip", () => {
    for (const [spec, first] of [
      [PADDLE_NORMAL, 0xaa00],
      [PADDLE_LARGE, 0xab28],
      [PADDLE_SMALL, 0xabfa],
    ] as const) {
      const anim = createAnim(spec);
      for (let i = 0; i < 50; i++) {
        stepAnim(anim);
        expect(skinnedFrame(anim, "player2")).toBe(anim.frame - spec.first + first);
      }
    }
    const warp = createAnim(warpOf(Large).spec);
    while (warp.frame === warp.first) stepAnim(warp);
    expect(skinnedFrame(warp, "player2")).toBe(0xe1d01 + warp.step);
  });

  it("shifts a ball by 9 px, whatever its state (0x4038E4, 0x403998)", () => {
    expect(skinnedFrame(createBall(100).anim, "player2")).toBe(0x1680 + 9);
    const ghost = ghostBall();
    expect(skinnedFrame(ghost.anim, "player2")).toBe(0x1692 + 9);
    makeIron(ghost);
    expect(skinnedFrame(ghost.anim, "player2")).toBe(0x12 + 9);
    const iron = createBall(100);
    makeIron(iron);
    expect(skinnedFrame(iron.anim, "player2")).toBe(9);
  });

  it("fades a dying ball in its own colour, unlike the original (0x40466B)", () => {
    const green = ghostBall();
    ghostContact(green);
    expect(skinnedFrame(green.anim, "player2")).toBe(0x16ae + 0x46);
    while (green.anim.frame === green.anim.first) stepAnim(green.anim);
    expect(skinnedFrame(green.anim, "player2")).toBe(0x16ae + 0x46 + 10);

    const gold = ghostBall();
    makeIron(gold);
    ghostContact(gold);
    expect(skinnedFrame(gold.anim, "player2")).toBe(0x2e + 0x46);
  });

  it("leaves a sprite out of the table alone", () => {
    const other = { first: 0x12345, frame: 0x12345 + 40 };
    expect(skinnedFrame(other, "player2")).toBe(other.frame);
  });
});

describe("player 1 skin", () => {
  it("draws the original addresses", () => {
    expect(shown(Normal, "player1")).toBe(Normal);
    expect(skinnedFrame({ first: Large, frame: Large + 0x69 }, "player1")).toBe(Large + 0x69);
    expect(skinnedCapsule(0x75801, "player1")).toBe(0x75801);
    expect(skinnedLifeIcons("player1")).toBe(LIFE_ICONS);
  });
});

describe("green rows", () => {
  it("takes the capsule one row of 25 lines down (0x405405)", () => {
    const code = 0x75801 + 3 * 0x1a;
    const p1 = capsuleSprite(code);
    expect(capsuleSprite(skinnedCapsule(code, "player2"))).toEqual({ ...p1, y: p1.y + 25 });
  });

  it("takes the lives one row of 9 lines down (0x405B81)", () => {
    const p1 = livesSprite(3);
    expect(livesSprite(3, "player2")).toEqual({ ...p1, ref: { ...p1.ref, y: p1.ref.y + 9 } });
  });
});
