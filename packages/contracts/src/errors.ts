/** Every `error` an API reply may carry: a category, never the cause. */
export const API_ERRORS = [
  // Generic, set by the API's error handler from the HTTP status.
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "too_large",
  "unsupported_media_type",
  "too_many_requests",
  "internal",
  "busy",
  // Account routes.
  "invalid_credentials",
  "email_not_verified",
  "locked",
  "invalid_token",
  "pseudo_taken",
  "pseudo_refused",
  // Game routes.
  "game_closed",
  "replay_refused",
] as const;

export type ApiErrorCode = (typeof API_ERRORS)[number];

export interface ApiError {
  error: ApiErrorCode;
}

/** Sign-in refused during a progressive lock (docs/cadrage.md, Sécurité). */
export interface LockedError {
  error: "locked";
  retryAfterSeconds: number;
}

export const errorReply = {
  type: "object",
  required: ["error"],
  additionalProperties: false,
  properties: { error: { type: "string", enum: API_ERRORS } },
} as const;

export const lockedReply = {
  type: "object",
  required: ["error", "retryAfterSeconds"],
  additionalProperties: false,
  properties: {
    error: { type: "string", const: "locked" },
    retryAfterSeconds: { type: "integer", minimum: 1 },
  },
} as const;
