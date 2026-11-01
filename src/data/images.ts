const range = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}_${i + 1}`);

/** World order of the world menu: space loads sprite0.pal, arcade sprite1.pal (0x40172A). */
export const WORLDS = ["space", "arcade"] as const;
export type World = (typeof WORLDS)[number];

/** In-game sprites, re-paletted per world with index 0 transparent (extract_assets.py). */
export const WORLD_SPRITES = ["sprite_sheet", "font", "monsters"] as const;
export type WorldSprite = (typeof WORLD_SPRITES)[number];

export const worldImage = (world: World, sprite: WorldSprite) => `sprites/${world}/${sprite}`;

/** Backgrounds per world: resource/0W_0N.gif (W = world digit). */
export const WORLD_BACKGROUNDS = 8;

/** 0x407430: background N = 1 + ((level − 1) & 7), so they cycle every 8 levels. */
export const backgroundImage = (world: World, level: number) =>
  `backgrounds/${world}_${((level - 1) & (WORLD_BACKGROUNDS - 1)) + 1}`;

/** Indices 1..15 of the sprite sheet, recoloured per background (§3.5, render/recolor.ts). */
export const SHEET_LOW_MASK = "sprites/sprite_sheet_low";

/** Frame colours 112..127 of the active-bonus icons (§3.5, render/flash.ts). */
export const SHEET_FLASH_MASK = "sprites/sprite_sheet_flash";

/** Palette entries of menu.gif, for the pulse of the hovered quadrant (render/menu.ts). */
export const MENU_INDEX_MASK = "sprites/menu_index";

/** fonte.gif under the menu palette. */
export const MENU_FONT = "sprites/menu_font";

/** Screen N of the credits, in the order of the overlay. */
export const creditImage = (n: number) => `credits/credit_${n}`;
/** Its entries 0xE0..0xFF, which 0x401BD5 fades in first. */
export const creditText = (n: number) => `${creditImage(n)}_text`;
const CREDIT_IMAGES = 6;

/** Every PNG written by tools/extract/extract_assets.py, without extension. */
export const IMAGE_NAMES = [
  "backgrounds/title",
  "backgrounds/media",
  ...WORLDS.flatMap((world) => range(`backgrounds/${world}`, WORLD_BACKGROUNDS)),
  "sprites/sprite_sheet",
  SHEET_LOW_MASK,
  SHEET_FLASH_MASK,
  "sprites/font",
  "sprites/menu",
  MENU_INDEX_MASK,
  MENU_FONT,
  "sprites/monsters",
  ...Array.from({ length: CREDIT_IMAGES }, (_, i) => [
    creditImage(i + 1),
    creditText(i + 1),
  ]).flat(),
  ...WORLDS.flatMap((world) => WORLD_SPRITES.map((sprite) => worldImage(world, sprite))),
];

export type Images = ReadonlyMap<string, HTMLImageElement>;

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image ${url}`));
    img.src = url;
  });
}

export async function loadImages(base: string, names: readonly string[]): Promise<Images> {
  const images = await Promise.all(names.map((name) => loadImage(`${base}${name}.png`)));
  return new Map(names.map((name, i) => [name, images[i]!]));
}
