import { EMAIL_MAX, EMAIL_PATTERN, PASSWORD_MAX, PASSWORD_MIN, PASSWORD_PATTERN } from "./rules";

/*
 * Bodies of the /api/auth routes. Each schema sits next to its type: the API validates against
 * the schema, the website builds the body from the type.
 */

const email = { type: "string", minLength: 3, maxLength: EMAIL_MAX, pattern: EMAIL_PATTERN };
const password = {
  type: "string",
  minLength: PASSWORD_MIN,
  maxLength: PASSWORD_MAX,
  pattern: PASSWORD_PATTERN,
};
/** Any password a past rule may have allowed: sign-in only compares, never judges. */
const anyPassword = { type: "string", minLength: 1, maxLength: PASSWORD_MAX };
/** 32 random bytes in base64url. */
const token = { type: "string", minLength: 43, maxLength: 43, pattern: "^[A-Za-z0-9_-]+$" };

const object = <P extends Record<string, unknown>>(properties: P) =>
  ({
    type: "object",
    required: Object.keys(properties) as (keyof P & string)[],
    additionalProperties: false,
    properties,
  }) as const;

export interface SignUpBody {
  email: string;
  password: string;
}
export const signUpBody = object({ email, password });

export interface SignInBody {
  email: string;
  password: string;
}
export const signInBody = object({ email, password: anyPassword });

export interface EmailBody {
  email: string;
}
/** Resending the verification link, or asking for a reset link. */
export const emailBody = object({ email });

export interface TokenBody {
  token: string;
}
export const tokenBody = object({ token });

export interface ResetPasswordBody {
  token: string;
  password: string;
}
export const resetPasswordBody = object({ token, password });

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}
export const changePasswordBody = object({ currentPassword: anyPassword, newPassword: password });
