import { SOUND_NAMES } from "../audio/rules";
import type { SoundName } from "../game/game";
import { type GameConfig, parseConfig } from "./config";
import { type FlcFile, parseFlc } from "./flc";
import { IMAGE_NAMES, type Images, WORLDS, type World, loadImages } from "./images";
import { type LevelSet, parseLevels } from "./levels";
import {
  type BackgroundColors,
  type VgaPalette,
  parseBackgroundPalettes,
  parsePalette,
} from "./palette";
import { parseWav } from "./wav";

export interface Assets {
  config: GameConfig;
  levels: LevelSet;
  images: Images;
  palettes: Record<World, VgaPalette>;
  /** Keyed by background image name, as given by backgroundImage(). */
  backgroundColors: Record<string, BackgroundColors>;
  sounds: Record<SoundName, Uint8Array>;
  /** Played by the credits. blaster.flc, 29 MB, waits for loadEndFilm(). */
  intro: FlcFile;
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: HTTP ${res.status}`);
  return res;
}

const fetchJson = async (url: string): Promise<unknown> => (await fetchOk(url)).json();

async function loadPalettes(base: string): Promise<Record<World, VgaPalette>> {
  const pals = await Promise.all(
    WORLDS.map(async (_, i) => {
      const url = `${base}palettes/sprite${i}.pal`;
      return parsePalette(await (await fetchOk(url)).arrayBuffer(), url);
    }),
  );
  return Object.fromEntries(WORLDS.map((w, i) => [w, pals[i]!])) as Record<World, VgaPalette>;
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

// BASE_URL keeps paths relative, so the same build also works from file:// in Electron.
export async function loadAssets(base = import.meta.env.BASE_URL): Promise<Assets> {
  const [config, levels, images, palettes, backgroundColors, sounds, intro] = await Promise.all([
    fetchJson(`${base}config.json`).then(parseConfig),
    fetchJson(`${base}levels.json`).then(parseLevels),
    loadImages(base, IMAGE_NAMES),
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
  return { config, levels, images, palettes, backgroundColors, sounds, intro };
}
