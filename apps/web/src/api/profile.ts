import {
  DEMO_PROFILE,
  NEW_PROFILE,
  NEW_PROFILE_QUERY,
  REFUSED_WORD,
  TAKEN_PSEUDOS,
  type Profile,
} from "../fixtures/profile";

/*
 * Fake profile API: same signatures and answers as the future `/api` routes, backed by
 * fixtures. Only this file changes when the profile routes exist.
 */

export type ChangePseudoResult = { ok: true } | { ok: false; error: "taken" | "refused" };

let current: Profile | null = null;

const latency = () => new Promise((resolve) => setTimeout(resolve, 300));

function profile(): Profile {
  current ??= structuredClone(
    window.location.search === NEW_PROFILE_QUERY ? NEW_PROFILE : DEMO_PROFILE,
  );
  return current;
}

export async function getProfile(): Promise<Profile> {
  return structuredClone(profile());
}

/** The server checks the format again, then uniqueness (case-insensitive) and the insult filter. */
export async function changePseudo(pseudo: string): Promise<ChangePseudoResult> {
  await latency();
  const key = pseudo.toLowerCase();
  if (TAKEN_PSEUDOS.some((taken) => taken.toLowerCase() === key)) {
    return { ok: false, error: "taken" };
  }
  if (key.includes(REFUSED_WORD)) return { ok: false, error: "refused" };
  const me = profile();
  me.pseudo = pseudo;
  me.pseudoChosen = true;
  return { ok: true };
}

export async function changeAvatar(avatar: number): Promise<void> {
  await latency();
  profile().avatar = avatar;
}

export async function deleteAccount(): Promise<void> {
  await latency();
  current = null;
}

export async function signOut(): Promise<void> {
  await latency();
  current = null;
}
