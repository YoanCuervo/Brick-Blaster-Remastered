const range = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}_${i + 1}`);

/** World order of the world menu: space loads sprite0.pal, arcade sprite1.pal (0x40172A). */
export const WORLDS = ["space", "arcade"] as const;
export type World = (typeof WORLDS)[number];

/** In-game sprites, re-paletted per world with index 0 transparent (extract_assets.py). */
export const WORLD_SPRITES = ["sprite_sheet", "font", "monsters"] as const;
export type WorldSprite = (typeof WORLD_SPRITES)[number];

export const worldImage = (world: World, sprite: WorldSprite) => `sprites/${world}/${sprite}`;

/** Every PNG written by tools/extract/extract_assets.py, without extension. */
export const IMAGE_NAMES = [
  "backgrounds/title",
  "backgrounds/media",
  ...range("backgrounds/space", 8),
  ...range("backgrounds/arcade", 8),
  "sprites/sprite_sheet",
  "sprites/font",
  "sprites/menu",
  "sprites/monsters",
  ...range("credits/credit", 6),
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
