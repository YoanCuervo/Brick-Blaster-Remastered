import { LEADERBOARDS, type LeaderboardEntry } from "../fixtures/leaderboard";
import type { DifficultyId } from "../fixtures/profile";
import { getProfile } from "./profile";

/*
 * Fake leaderboard API: same signature and answer as the future `/api` route, backed by
 * fixtures. Only this file changes when the leaderboard route exists.
 */

export type { LeaderboardEntry };

export interface Leaderboard {
  /** The top 100, best first. */
  entries: LeaderboardEntry[];
  /** The signed-in player: their row in the top 100, else their record (null if none). */
  me: { pseudo: string; avatar: number | null; rank: number | null; record: number | null };
}

export async function getLeaderboard(difficulty: DifficultyId): Promise<Leaderboard> {
  const profile = await getProfile();
  const { rank, record } = profile.ranked[difficulty];
  // The fixtures hold the demo player: the row follows a pseudo or avatar changed meanwhile.
  const entries = LEADERBOARDS[difficulty].map((entry) =>
    entry.rank === rank ? { ...entry, pseudo: profile.pseudo, avatar: profile.avatar } : entry,
  );
  return {
    entries: structuredClone(entries),
    me: { pseudo: profile.pseudo, avatar: profile.avatar, rank, record },
  };
}
