import type { OriginalWorld, World } from "../data/images";
import type { SoundName } from "../game/game";

/** Sound files in the order of the slot table 0x41B9BB. */
export const SOUND_NAMES = [
  "optionon",
  "telepod",
  "newlife",
  "small",
  "large",
  "next",
  "death",
  "shoot",
  "endopt",
  "night",
  "restart",
  "speedup",
  "monstoff",
  "wall",
  "bounce",
  "pertebal",
  "boom",
] as const satisfies readonly SoundName[];

/** Amiga clock of the mixer: step = clock / period (0x40C8BF, 0x40C8D3). */
const MIXER_CLOCK = 0x369de4;
/** Period passed for every sound (0x405749): the 8363 Hz of the IFF headers is never read. */
const SOUND_PERIOD = 0x10f;
export const SOUND_RATE = MIXER_CLOCK / SOUND_PERIOD;

/** Volumes of the original, 0..64. Defaults of the user file data 0x41BB56. */
export const MAX_VOLUME = 0x40;
export const DEFAULT_MUSIC_VOLUME = 0x20;
export const DEFAULT_SOUND_VOLUME = 0x40;

/** Sounds whose VHDR volume is 0x8000 instead of 0x10000, read at 0x40D034. */
const HALF_VOLUME_SOUNDS: readonly SoundName[] = ["monstoff", "wall", "pertebal", "boom"];

/**
 * Every sound goes to the same mixer voice: 0x405746 only picks the other one for handles
 * below 0x19, and the loader 0x40CFD1 hands out 0x81 or more. A new sound cuts the current
 * one, so of the sounds started in one tick only the last is heard.
 */
export function soundToPlay(sounds: readonly SoundName[]): SoundName | null {
  return sounds.at(-1) ?? null;
}

/** Modules of the original, keyed by their names in the asset pack (§3.3), then those of Limbes. */
export const MUSIC_CHANNELS = {
  love: 6,
  starr: 4,
  the_last: 4,
  hunting_in_lacanau: 6,
  rain_in_the_brain: 8,
  "8bit_castle": 4,
  dog39: 4,
  stars_4ch: 4,
} as const;
export type MusicName = keyof typeof MUSIC_CHANNELS;

export const MENU_MUSIC: MusicName = "love"; // 0x401058, 0x4011B4
export const CREDITS_MUSIC: MusicName = "starr"; // 0x4011FF
export const SCORES_MUSIC: MusicName = "rain_in_the_brain"; // 0x408BB9, 0x408B1A
/** Set by the world menu (0x401712, 0x40173B), started with the game (0x4011A4). */
export const WORLD_MUSIC: Record<OriginalWorld, MusicName> = {
  space: "the_last",
  arcade: "hunting_in_lacanau",
};

/** Not in the original, whose game music never changes with the level. */
export const LIMBES_MUSIC = [
  "stars_4ch",
  "dog39",
  "8bit_castle",
] as const satisfies readonly MusicName[];
export const LIMBES_MUSIC_LEVELS = 3;

export function worldMusic(world: World, level: number): MusicName {
  if (world !== "limbes") return WORLD_MUSIC[world];
  const turn = Math.floor((level - 1) / LIMBES_MUSIC_LEVELS);
  return LIMBES_MUSIC[turn % LIMBES_MUSIC.length]!;
}

/** Mixer voices reserved for the sounds (0x4077D9), after those of the module. */
const SOUND_VOICES = 2;

/** Level of one full-volume voice: the table 0x40C86E shares the output between the voices. */
export function voiceGain(moduleChannels: number): number {
  return 1 / Math.ceil((moduleChannels + SOUND_VOICES) / 2);
}

/**
 * Gain of the libopenmpt output for the same voice level as the original. Its voices peak at
 * 2 / channels (measured on a full-scale test module, stereo separation 200).
 */
export function musicGain(moduleChannels: number, musicVolume: number): number {
  return (musicVolume / MAX_VOLUME) * voiceGain(moduleChannels) * (moduleChannels / 2);
}

/** Gain of a sound under a module, 0x40C9E2: the volume product stops at 63/64. */
export function soundGain(name: SoundName, moduleChannels: number, soundVolume: number): number {
  const own = HALF_VOLUME_SOUNDS.includes(name) ? MAX_VOLUME / 2 : MAX_VOLUME;
  const level = Math.min((own * soundVolume) >> 6, MAX_VOLUME - 1);
  return (level / MAX_VOLUME) * voiceGain(moduleChannels);
}

/**
 * Pan of the sound voice, -1 left or +1 right. 0x40B693 pans voices 1 and 2 of each group
 * of 4 to the right, and the sound voice comes right after those of the module.
 */
export function soundPan(moduleChannels: number): -1 | 1 {
  const voice = moduleChannels & 3;
  return voice === 1 || voice === 2 ? 1 : -1;
}

/** 0x40666A takes one volume step per tick, down to -1. */
export function musicFadeTicks(musicVolume: number): number {
  return musicVolume + 1;
}

/**
 * 8-bit unsigned samples to floats at the output rate, repeating samples without interpolation
 * like the mixer 0x40CB74. Web Audio's own resampling would smooth the original's grain.
 */
export function holdResample(samples: Uint8Array, rate: number, outputRate: number): Float32Array {
  const step = rate / outputRate;
  const out = new Float32Array(Math.floor(samples.length / step));
  for (let i = 0; i < out.length; i++) {
    out[i] = (samples[Math.floor(i * step)]! - 128) / 128;
  }
  return out;
}
