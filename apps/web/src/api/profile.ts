import {
  DELETE_CONFIRMATION,
  type AvatarBody,
  type ChangePasswordBody,
  type DeleteAccountBody,
  type Me,
  type PseudoBody,
} from "@brick-blaster/contracts";
import { request, type Reply } from "./http";

/** /api/me routes. Every one answers 401 `unauthorized` once the session is gone. */

/** The signed-in player, or null without a session (or when the API cannot be reached). */
export async function getMe(): Promise<Me | null> {
  const reply = await request<Me>("GET", "/me");
  return reply.ok ? reply.data : null;
}

export const changePseudo = (pseudo: string): Promise<Reply<void>> =>
  request("PUT", "/me/pseudo", { pseudo } satisfies PseudoBody);

export const changeAvatar = (avatar: number): Promise<Reply<void>> =>
  request("PUT", "/me/avatar", { avatar } satisfies AvatarBody);

export const changePassword = (body: ChangePasswordBody): Promise<Reply<void>> =>
  request("PUT", "/me/password", body);

export const deleteAccount = (): Promise<Reply<void>> =>
  request("DELETE", "/me", { confirm: DELETE_CONFIRMATION } satisfies DeleteAccountBody);

export const signOut = (): Promise<Reply<void>> => request("POST", "/auth/sign-out");
