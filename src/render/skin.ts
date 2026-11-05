// Player 2 colours of the sprite sheet, display only: the game state stays on player 1
// addresses because the rules compare them (game.ts, PaddleSprite).
import type { World } from "../data/images";
import { ARRIVAL, PaddleSprite, explosionOf, warpOf } from "../game/animation";
import {
  BALL_SPRITE,
  GHOST_DEATH,
  GHOST_OFFSET,
  IRON_GHOST_DEATH,
  IRON_SPRITE,
} from "../game/ball";
import { LIFE_ICONS } from "./atlas";

export type PlayerSkin = "player1" | "player2";

/** Limbes wears the player 2 colours, a deliberate difference (docs/cadrage.md). */
export function worldPlayerSkin(world: World): PlayerSkin {
  return world === "limbes" ? "player2" : "player1";
}

/** The player 2 ball is the sprite right of the player 1 one (0x4038E4, 0x403998). */
const BALL_DX = 9;
/**
 * Not in the original, where a player 2 ghost ball dies as a blue iron ball (0x40466B compares
 * only against 0x1692). These frames have the same pixels as the player 1 fade, one frame
 * further than 0x3C, which would start on the intact ring and drop the last frame.
 */
const BALL_DEATH_DX = 0x46;

const { Large, Normal, Small } = PaddleSprite;

const PLAYER2_FIRST: ReadonlyMap<number, number> = new Map([
  // 0x4030F4, 0x4032CC
  [Normal, 0xaa00],
  [Large, 0xab28],
  [Small, 0xabfa],
  // 0x4030DC..0x403162
  [explosionOf(Normal).spec.first, 0x89081],
  [explosionOf(Large).spec.first, 0x89155],
  [explosionOf(Small).spec.first, 0x890f8],
  // 0x4032B4..0x40333A
  [warpOf(Normal).spec.first, 0xcdde5],
  [warpOf(Large).spec.first, 0xe1d01],
  [warpOf(Small).spec.first, 0xcde9f],
  // 0x40329D
  [ARRIVAL.spec.first, 0xcde42],
  [BALL_SPRITE, BALL_SPRITE + BALL_DX],
  [BALL_SPRITE + GHOST_OFFSET, BALL_SPRITE + GHOST_OFFSET + BALL_DX],
  [IRON_SPRITE, IRON_SPRITE + BALL_DX],
  [IRON_SPRITE + GHOST_OFFSET, IRON_SPRITE + GHOST_OFFSET + BALL_DX],
  [GHOST_DEATH, GHOST_DEATH + BALL_DEATH_DX],
  [IRON_GHOST_DEATH, IRON_GHOST_DEATH + BALL_DEATH_DX],
]);

/** The green row, one icon height below the player 1 one (0x405B81). */
const PLAYER2_LIFE_ICONS = 0x18f7;
/** The green row, under the player 1 capsules (0x405405). */
const PLAYER2_CAPSULE_OFFSET = 0x3e80;

/** Frame to draw for a paddle or ball animation; its offset in the strip is kept. */
export function skinnedFrame(anim: { first: number; frame: number }, skin: PlayerSkin): number {
  if (skin === "player1") return anim.frame;
  const first = PLAYER2_FIRST.get(anim.first);
  return first === undefined ? anim.frame : anim.frame + first - anim.first;
}

export function skinnedCapsule(code: number, skin: PlayerSkin): number {
  return skin === "player2" ? code + PLAYER2_CAPSULE_OFFSET : code;
}

export function skinnedLifeIcons(skin: PlayerSkin): number {
  return skin === "player2" ? PLAYER2_LIFE_ICONS : LIFE_ICONS;
}
