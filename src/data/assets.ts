import { SOUND_NAMES } from "../audio/rules";
import type { SoundName } from "../game/game";
import { type GameConfig, parseConfig } from "./config";
import { type FlcFile, parseFlc } from "./flc";
import {
  FREE_BACKGROUND_COLORS,
  IMAGE_NAMES,
  type Images,
  ORIGINAL_WORLDS,
  type OriginalWorld,
  loadImage,
  loadImages,
} from "./images";
import { type WorldLevelSets, parseLevels } from "./levels";
import { LIMBES_LEVELS } from "./limbesLevels";
import {
  type BackgroundColors,
  type VgaPalette,
  parseBackgroundPalettes,
  parsePalette,
} from "./palette";
import { parseWav } from "./wav";

export interface Assets {
  config: GameConfig;
  levels: WorldLevelSets;
  images: Images;
  palettes: Record<OriginalWorld, VgaPalette>;
  /** Keyed by background image name, as given by backgroundImage(). */
  backgroundColors: Record<string, BackgroundColors>;
  sounds: Record<SoundName, Uint8Array>;
  /** Played by the credits. blaster.flc, 29 MB, waits for loadEndFilm(). */
  intro: FlcFile;
}

/** Unlike the pack, these are versioned: Vite bundles them, and their URLs are not derived. */
const FREE_BACKGROUNDS = Object.entries(
  import.meta.glob<string>("../assets/backgrounds/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  }),
).map(([file, url]) => [`backgrounds/${file.split("/").pop()!.replace(".png", "")}`, url] as const);

const loadFreeBackgrounds = () =>
  Promise.all(FREE_BACKGROUNDS.map(async ([name, url]) => [name, await loadImage(url)] as const));

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: HTTP ${res.status}`);
  return res;
}

const fetchJson = async (url: string): Promise<unknown> => (await fetchOk(url)).json();

async function loadPalettes(base: string): Promise<Record<OriginalWorld, VgaPalette>> {
  const pals = await Promise.all(
    ORIGINAL_WORLDS.map(async (_, i) => {
      const url = `${base}palettes/sprite${i}.pal`;
      return parsePalette(await (await fetchOk(url)).arrayBuffer(), url);
    }),
  );
  return Object.fromEntries(ORIGINAL_WORLDS.map((w, i) => [w, pals[i]!])) as Record<
    OriginalWorld,
    VgaPalette
  >;
}

async function loadSounds(base: string): Promise<Record<SoundName, Uint8Array>> {
  const sounds = await Promise.all(
    SOUND_NAMES.map(async (name) => {
      const url = `${base}sounds/${name}.wav`;
      return [name, parseWav(await (await fetchOk(url)).arrayBuffer(), url)] as const;
    }),
  );
  return Object.fromEntries(sounds) as Record<SoundName, Uint8Array>;
}

async function loadFlc(url: string): Promise<FlcFile> {
  return parseFlc(await (await fetchOk(url)).arrayBuffer(), url);
}

export const loadEndFilm = (base = import.meta.env.BASE_URL): Promise<FlcFile> =>
  loadFlc(`${base}video/blaster.flc`);

// BASE_URL is "/": Electron serves this same build from the root of its app:// origin.
export async function loadAssets(base = import.meta.env.BASE_URL): Promise<Assets> {
  const [config, levels, packImages, freeImages, palettes, backgroundColors, sounds, intro] =
    await Promise.all([
      fetchJson(`${base}config.json`).then(parseConfig),
      fetchJson(`${base}levels.json`).then(parseLevels),
      loadImages(base, IMAGE_NAMES),
      loadFreeBackgrounds(),
      loadPalettes(base),
      fetchJson(`${base}backgrounds/palettes.json`).then((json) =>
        Object.fromEntries(
          Object.entries(parseBackgroundPalettes(json)).map(([name, colors]) => [
            `backgrounds/${name}`,
            colors,
          ]),
        ),
      ),
      loadSounds(base),
      loadFlc(`${base}video/intro.flc`),
    ]);
  for (const [name] of freeImages) {
    backgroundColors[name] = backgroundColors[FREE_BACKGROUND_COLORS]!;
  }
  return {
    config,
    levels: { ...levels, limbes: LIMBES_LEVELS },
    images: new Map([...packImages, ...freeImages]),
    palettes,
    backgroundColors,
    sounds,
    intro,
  };
}
