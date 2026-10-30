import { type GameConfig, parseConfig } from "./config";
import { IMAGE_NAMES, type Images, WORLDS, type World, loadImages } from "./images";
import { type LevelSet, parseLevels } from "./levels";
import { type VgaPalette, parsePalette } from "./palette";

export interface Assets {
  config: GameConfig;
  levels: LevelSet;
  images: Images;
  palettes: Record<World, VgaPalette>;
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

// BASE_URL keeps paths relative, so the same build also works from file:// in Electron.
export async function loadAssets(base = import.meta.env.BASE_URL): Promise<Assets> {
  const [config, levels, images, palettes] = await Promise.all([
    fetchJson(`${base}config.json`).then(parseConfig),
    fetchJson(`${base}levels.json`).then(parseLevels),
    loadImages(base, IMAGE_NAMES),
    loadPalettes(base),
  ]);
  return { config, levels, images, palettes };
}
