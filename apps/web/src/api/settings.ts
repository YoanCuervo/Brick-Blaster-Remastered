import type { AccountSettings, SettingsBody } from "@brick-blaster/contracts";
import { request, type Reply } from "./http";

/** The game settings kept on the account; null when they cannot be read. */
export async function getSettings(): Promise<AccountSettings | null> {
  const reply = await request<AccountSettings>("GET", "/me/settings");
  return reply.ok ? reply.data : null;
}

export const saveSettings = (settings: SettingsBody): Promise<Reply<void>> =>
  request("PUT", "/me/settings", {
    musicVolume: settings.musicVolume,
    mouseSensitivity: settings.mouseSensitivity,
  } satisfies SettingsBody);
