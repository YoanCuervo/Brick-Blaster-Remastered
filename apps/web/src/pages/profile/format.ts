import type { DifficultyId, WorldId } from "@brick-blaster/contracts";

export const WORLDS: readonly { id: WorldId; name: string }[] = [
  { id: "espace", name: "Espace" },
  { id: "arcade", name: "Arcade" },
  { id: "limbes", name: "Limbes" },
];
export const DIFFICULTIES: readonly DifficultyId[] = [0, 1, 2];
const DIFFICULTY_NAMES = ["Facile", "Moyen", "Difficile"] as const;

const numbers = new Intl.NumberFormat("fr-FR");
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** 48213 → « 48 213 »; null → « — ». */
export const formatScore = (value: number | null): string =>
  value === null ? "—" : numbers.format(value);

/** 45600 s → « 12 h 40 »; under an hour, « 18 min ». */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

export const formatDate = (iso: string): string => shortDate.format(new Date(iso));

/** « Aujourd'hui », « Hier », then the short date. */
export function formatDay(iso: string, now = new Date()): string {
  const day = new Date(iso);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (day.getTime() >= midnight) return "Aujourd'hui";
  if (day.getTime() >= midnight - 86_400_000) return "Hier";
  return formatDate(iso);
}

export const worldName = (id: WorldId): string => WORLDS.find((w) => w.id === id)?.name ?? id;
export const difficultyName = (id: DifficultyId): string => DIFFICULTY_NAMES[id];
