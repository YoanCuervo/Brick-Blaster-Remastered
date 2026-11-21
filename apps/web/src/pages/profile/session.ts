import type { Reply } from "../../api/http";
import { navigate } from "../../router";
import { ROUTES } from "../../routes";

/** True when the session is gone (expired, signed out elsewhere): the player is sent to sign-in. */
export function sessionLost(reply: Reply<unknown>): boolean {
  if (reply.ok || reply.error !== "unauthorized") return false;
  navigate(ROUTES.signIn, { replace: true });
  return true;
}
