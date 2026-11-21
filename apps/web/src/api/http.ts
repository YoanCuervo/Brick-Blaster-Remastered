import type { ApiErrorCode } from "@brick-blaster/contracts";

/** `network` when no reply came back at all (offline, API down, proxy error page). */
export type RequestError = ApiErrorCode | "network";

export type Reply<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: RequestError; retryAfterSeconds?: number };

/** One call to the API, same origin: the session cookie travels on its own. */
export async function request<T = void>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<Reply<T>> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
  const json: unknown = await response.json().catch(() => undefined);
  if (response.ok) return { ok: true, data: json as T };
  const reply = json as { error?: ApiErrorCode; retryAfterSeconds?: number } | undefined;
  if (!reply?.error) return { ok: false, status: response.status, error: "network" };
  return {
    ok: false,
    status: response.status,
    error: reply.error,
    retryAfterSeconds: reply.retryAfterSeconds,
  };
}

/** Shown for every failure a form has no specific message for. */
export const GENERIC_ERROR = "Une erreur est survenue, réessaie plus tard.";
