import { LEADERBOARDS, type LeaderboardEntry } from "../fixtures/leaderboard";
import { DEMO_PROFILE, type DifficultyId } from "../fixtures/profile";
import { getMe } from "./profile";

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
  // Ranks stay the demo player's until the score routes exist; the name and face are the account's.
  const profile = { ...DEMO_PROFILE, ...(await getMe()) };
  const { rank, record } = profile.ranked[difficulty];
  const entries = LEADERBOARDS[difficulty].map((entry) =>
    entry.rank === rank ? { ...entry, pseudo: profile.pseudo, avatar: profile.avatar } : entry,
  );
  return {
    entries: structuredClone(entries),
    me: { pseudo: profile.pseudo, avatar: profile.avatar, rank, record },
  };
}
