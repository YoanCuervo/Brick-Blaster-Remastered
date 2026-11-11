import { describe, expect, it } from "vitest";
import { DEFAULT_MUSIC_VOLUME } from "../audio/rules";
import { DEFAULT_SENSITIVITY } from "../input/mouse";
import { SETTINGS_KEY, loadSettings, saveSettings } from "./settings";

const store = (value: string | null) => ({
  value,
  getItem() {
    return this.value;
  },
  setItem(_: string, v: string) {
    this.value = v;
  },
});
const defaults = { musicVolume: DEFAULT_MUSIC_VOLUME, mouseSensitivity: DEFAULT_SENSITIVITY };

describe("settings", () => {
  it("defaults without storage, like a first run", () => {
    expect(loadSettings(null)).toEqual(defaults);
    expect(loadSettings(store(null))).toEqual(defaults);
  });

  it("reads back what it saved", () => {
    const s = store(null);
    saveSettings(s, { musicVolume: 10, mouseSensitivity: 1.5 });
    expect(loadSettings(s)).toEqual({ musicVolume: 10, mouseSensitivity: 1.5 });
  });

  it("ignores broken or out of range values", () => {
    expect(loadSettings(store("{not json"))).toEqual(defaults);
    const bad = JSON.stringify({ musicVolume: 65, mouseSensitivity: "fast" });
    expect(loadSettings(store(bad))).toEqual(defaults);
    expect(loadSettings(store(JSON.stringify({ musicVolume: 0 }))).musicVolume).toBe(0);
  });

  it("survives a storage that throws", () => {
    const blocked = {
      getItem(): string {
        throw new Error(SETTINGS_KEY);
      },
      setItem(): void {
        throw new Error(SETTINGS_KEY);
      },
    };
    expect(loadSettings(blocked)).toEqual(defaults);
    expect(() => saveSettings(blocked, defaults)).not.toThrow();
  });
});
