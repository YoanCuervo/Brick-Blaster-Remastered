import { SESSION_COOKIE } from "../auth/sessions";
import { TRIAL_COOKIE } from "../auth/trial";
import type { TestApp } from "./testApp";

export const PASSWORD = "Brique-Bleue9";

type Method = "GET" | "POST" | "PUT" | "DELETE";

export async function call(
  t: TestApp,
  method: Method,
  url: string,
  options: { body?: object; cookie?: string | null; trial?: string | null; ip?: string } = {},
) {
  const cookies = [
    options.cookie ? `${SESSION_COOKIE}=${options.cookie}` : null,
    options.trial ? `${TRIAL_COOKIE}=${options.trial}` : null,
  ].filter((c) => c !== null);
  return t.app.inject({
    method,
    url: `/api${url}`,
    ...(options.body ? { payload: options.body } : {}),
    headers: cookies.length > 0 ? { cookie: cookies.join("; ") } : {},
    remoteAddress: options.ip ?? "127.0.0.1",
  });
}

/** The session id a reply sets, "" when it clears the cookie, null when it leaves it alone. */
export function cookieOf(res: { headers: Record<string, unknown> }): string | null {
  const header = res.headers["set-cookie"];
  const line = Array.isArray(header) ? header[0] : header;
  if (typeof line !== "string") return null;
  const match = new RegExp(`^${SESSION_COOKIE}=([^;]*)`).exec(line);
  return match ? match[1]! : null;
}

/** The token of the last link mailed to `to`. */
export function tokenMailedTo(t: TestApp, to: string): string {
  const mail = t.mails.filter((m) => m.to === to).at(-1);
  const token = mail && /\?token=([A-Za-z0-9_-]{43})/.exec(mail.text)?.[1];
  if (!token) throw new Error(`no link mailed to ${to}`);
  return token;
}

/** Signs up, follows the link of the email, signs in: returns the session id. */
export async function signedIn(t: TestApp, email = "nova@exemple.fr", password = PASSWORD) {
  await call(t, "POST", "/auth/sign-up", { body: { email, password } });
  await call(t, "POST", "/auth/verify-email", { body: { token: tokenMailedTo(t, email) } });
  const res = await call(t, "POST", "/auth/sign-in", { body: { email, password } });
  const cookie = cookieOf(res);
  if (res.statusCode !== 200 || !cookie) throw new Error(`sign-in failed: ${res.body}`);
  return cookie;
}

/** The value a reply gives to one cookie, "" when it clears it, null when it leaves it alone. */
export function setCookie(res: { headers: Record<string, unknown> }, name: string): string | null {
  const header = res.headers["set-cookie"];
  const lines = Array.isArray(header) ? header : [header];
  for (const line of lines) {
    const match = typeof line === "string" && new RegExp(`^${name}=([^;]*)`).exec(line);
    if (match) return match[1]!;
  }
  return null;
}
