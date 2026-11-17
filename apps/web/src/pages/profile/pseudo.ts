/** Client-side pseudo checks, for quick feedback: the API validates the pseudo again. */

export const PSEUDO_MIN = 3;
/** The name column of the game's score table (packages/game/src/ui/scores.ts, NAME_LENGTH). */
export const PSEUDO_MAX = 15;

/*
 * The game types names in printable ASCII and forces them to lowercase with `or al, 0x20`
 * (0x408D3C): letters and 0x20-0x3F survive, but @ [ \ ] ^ _ would turn into other symbols.
 */
const ALLOWED = /^[A-Za-z0-9 !"#$%&'()*+,\-./:;<=>?]+$/;
// Kept for the provisional pseudos given at sign-up (docs/cadrage.md, Comptes).
const RESERVED = /^joueur\d+$/i;

export function checkPseudo(pseudo: string): string | null {
  if (pseudo.length < PSEUDO_MIN) return `${PSEUDO_MIN} caractères au moins.`;
  if (!ALLOWED.test(pseudo)) return "Lettres sans accent, chiffres, espaces et ponctuation simple.";
  if (RESERVED.test(pseudo)) return "Ce pseudo est réservé.";
  return null;
}
