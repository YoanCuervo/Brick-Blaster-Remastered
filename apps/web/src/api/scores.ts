import type { DifficultyId, Leaderboard, PlayerCard, Profile } from "@brick-blaster/contracts";
import { request, type Reply } from "./http";

/** GET /api/me/profile: 401 `unauthorized` without a session. */
export const getProfile = (): Promise<Reply<Profile>> => request("GET", "/me/profile");

/** GET /api/leaderboard/:difficulty: `me` is filled when signed in and ranked. */
export const getLeaderboard = (difficulty: DifficultyId): Promise<Reply<Leaderboard>> =>
  request("GET", `/leaderboard/${difficulty}`);

/** GET /api/players/:pseudo: the hover card of a ranked player. */
export const getPlayerCard = (
  pseudo: string,
  difficulty: DifficultyId,
): Promise<Reply<PlayerCard>> =>
  request("GET", `/players/${encodeURIComponent(pseudo)}?difficulty=${difficulty}`);
