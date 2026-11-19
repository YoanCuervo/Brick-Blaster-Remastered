import { createHash, randomBytes } from "node:crypto";

/** 32 random bytes in base64url: 43 characters, as the contracts' token schema expects. */
export const newToken = (): string => randomBytes(32).toString("base64url");

/** Only this goes to the database, so that a leak of it opens no session and no link. */
export const sha256 = (value: string): Buffer => createHash("sha256").update(value).digest();

/** One spelling per mailbox, for the account and for the sign-in lock alike. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
