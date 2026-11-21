import { DEFAULT_MUSIC_VOLUME, MAX_VOLUME } from "../audio/rules";
import { DEFAULT_SENSITIVITY } from "../input/mouse";

/** The original kept the music volume in its .usr file (0x4079CB). */
export interface Settings {
  musicVolume: number;
  mouseSensitivity: number;
}

export const SETTINGS_KEY = "brick-blaster.settings";
export const MIN_SENSITIVITY = 0.1;
export const MAX_SENSITIVITY = 3;

export type Store = Pick<Storage, "getItem" | "setItem">;

const inRange = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === "number" && v >= min && v <= max ? v : fallback;

function readSaved(store: Store | null): Partial<Record<keyof Settings, unknown>> | null {
  try {
    return JSON.parse(store?.getItem(SETTINGS_KEY) ?? "null") as ReturnType<typeof readSaved>;
  } catch {
    return null;
  }
}

/** Storage can be missing, refuse access or hold garbage: the game then runs on the defaults. */
export function loadSettings(store: Store | null): Settings {
  const saved = readSaved(store);
  return {
    musicVolume: inRange(saved?.musicVolume, 0, MAX_VOLUME, DEFAULT_MUSIC_VOLUME),
    mouseSensitivity: inRange(
      saved?.mouseSensitivity,
      MIN_SENSITIVITY,
      MAX_SENSITIVITY,
      DEFAULT_SENSITIVITY,
    ),
  };
}

/** Settings kept outside the game, the website's account; null or missing: not set there. */
export type KeptSettings = { [K in keyof Settings]?: number | null };

/**
 * Copies the kept settings into storage, then plays on them. A setting not kept there, or out of
 * range, stays as storage had it.
 */
export function adoptSettings(store: Store | null, kept: KeptSettings | null): Settings {
  const local = loadSettings(store);
  const settings = {
    musicVolume: inRange(kept?.musicVolume, 0, MAX_VOLUME, local.musicVolume),
    mouseSensitivity: inRange(
      kept?.mouseSensitivity,
      MIN_SENSITIVITY,
      MAX_SENSITIVITY,
      local.mouseSensitivity,
    ),
  };
  saveSettings(store, settings);
  return settings;
}

export function saveSettings(store: Store | null, settings: Settings): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Full or blocked storage only costs the settings of the next session.
  }
}

export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
