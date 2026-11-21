import { MAX_SENSITIVITY, MAX_VOLUME, MIN_SENSITIVITY } from "./rules";

/** The game's settings kept on the account; null until the player changes it in the game. */
export interface AccountSettings {
  musicVolume: number | null;
  mouseSensitivity: number | null;
}

/** What the game sends after a change: both settings, always. */
export interface SettingsBody {
  musicVolume: number;
  mouseSensitivity: number;
}

const musicVolume = { type: "integer", minimum: 0, maximum: MAX_VOLUME } as const;
const mouseSensitivity = {
  type: "number",
  minimum: MIN_SENSITIVITY,
  maximum: MAX_SENSITIVITY,
} as const;

export const settingsReply = {
  type: "object",
  required: ["musicVolume", "mouseSensitivity"],
  additionalProperties: false,
  properties: {
    musicVolume: { ...musicVolume, type: ["integer", "null"] },
    mouseSensitivity: { ...mouseSensitivity, type: ["number", "null"] },
  },
} as const;

export const settingsBody = {
  type: "object",
  required: ["musicVolume", "mouseSensitivity"],
  additionalProperties: false,
  properties: { musicVolume, mouseSensitivity },
} as const;
