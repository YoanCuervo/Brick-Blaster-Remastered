import { type GameConfig, parseConfig } from "./config";
import { IMAGE_NAMES, type Images, loadImages } from "./images";
import { type LevelSet, parseLevels } from "./levels";

export interface Assets {
  config: GameConfig;
  levels: LevelSet;
  images: Images;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to load ${url}: HTTP ${res.status}`);
  return res.json();
}

// BASE_URL keeps paths relative, so the same build also works from file:// in Electron.
export async function loadAssets(base = import.meta.env.BASE_URL): Promise<Assets> {
  const [config, levels, images] = await Promise.all([
    fetchJson(`${base}config.json`).then(parseConfig),
    fetchJson(`${base}levels.json`).then(parseLevels),
    loadImages(base, IMAGE_NAMES),
  ]);
  return { config, levels, images };
}
