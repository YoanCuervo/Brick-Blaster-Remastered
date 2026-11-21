/**
 * Field rules shared by the website (quick feedback) and the API (the real check). The patterns
 * are strings because JSON Schema carries them; ajv compiles them with the `u` flag.
 */

/** CNIL deliberation 2022-100: 12 characters at least, drawn from 4 kinds. */
export const PASSWORD_MIN = 12;
/** Bounds the work of one hash; far beyond any password manager's output. */
export const PASSWORD_MAX = 128;
export const PASSWORD_PATTERN = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).*$";
export const PASSWORD_RULE =
  "12 caractères minimum, avec une minuscule, une majuscule, un chiffre et un caractère spécial.";

/** RFC 5321 limit of a forward path. */
export const EMAIL_MAX = 254;
// Deliberately loose: the verification link is the real check.
export const EMAIL_PATTERN = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

export const PSEUDO_MIN = 3;
/** The name column of the game's score table (packages/game/src/ui/scores.ts, NAME_LENGTH). */
export const PSEUDO_MAX = 15;
/*
 * The game types names in printable ASCII and forces them to lowercase with `or al, 0x20`
 * (0x408D3C): letters and 0x20-0x3F survive, but @ [ \ ] ^ _ would turn into other symbols.
 * No space at either end, where it could not be seen in a table.
 */
export const PSEUDO_PATTERN = "^(?! )(?!.* $)[A-Za-z0-9 !\"#$%&'()*+,\\-./:;<=>?]*$";
/** Kept for the provisional pseudos given at sign-up (docs/cadrage.md, Comptes). */
export const RESERVED_PSEUDO = /^joueur\d+$/i;

/** Size of the predefined avatar gallery (apps/web/src/components/Avatar.tsx). */
export const AVATAR_COUNT = 10;

/** The game's music volume scale (packages/game/src/audio/rules.ts, MAX_VOLUME). */
export const MAX_VOLUME = 64;
/** Mouse sensitivity bounds of the game (packages/game/src/ui/settings.ts). */
export const MIN_SENSITIVITY = 0.1;
export const MAX_SENSITIVITY = 3;

/** Typed by the player to confirm the deletion of their account. */
export const DELETE_CONFIRMATION = "SUPPRIMER";

const password = new RegExp(PASSWORD_PATTERN, "u");
const email = new RegExp(EMAIL_PATTERN, "u");
const pseudo = new RegExp(PSEUDO_PATTERN, "u");

/** Same verdict as the API's schema; length counted in code points, as ajv does. */
export function isValidPassword(value: string): boolean {
  const length = [...value].length;
  return length >= PASSWORD_MIN && length <= PASSWORD_MAX && password.test(value);
}

export function isValidEmail(value: string): boolean {
  return value.length <= EMAIL_MAX && email.test(value);
}

/** Format only: uniqueness, the reserved pattern and the insult filter are the API's. */
export function isValidPseudo(value: string): boolean {
  return value.length >= PSEUDO_MIN && value.length <= PSEUDO_MAX && pseudo.test(value);
}
