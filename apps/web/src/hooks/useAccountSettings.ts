import type { SettingsBody } from "@brick-blaster/contracts";
import { useCallback, useEffect, useRef } from "react";
import { getSettings, saveSettings } from "../api/settings";

/** Dragging a bar of the game's menu changes the setting at every step: only the last one goes. */
const SAVE_DELAY_MS = 500;

/** The game's settings on the signed-in player's account (see MountOptions.loadSettings). */
export function useAccountSettings() {
  const pending = useRef<SettingsBody | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const settings = pending.current;
    pending.current = null;
    if (settings) void saveSettings(settings);
  }, []);

  // Leaving the page sends a change still waiting.
  useEffect(() => flush, [flush]);

  const onSettingsChange = useCallback(
    (settings: SettingsBody) => {
      pending.current = settings;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  return { loadSettings: getSettings, onSettingsChange };
}
