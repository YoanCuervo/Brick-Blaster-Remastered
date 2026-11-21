import { PSEUDO_MAX, PSEUDO_MIN, RESERVED_PSEUDO, isValidPseudo } from "@brick-blaster/contracts";

/** Client-side pseudo checks, for quick feedback: the API validates the pseudo again. */

export { PSEUDO_MAX, PSEUDO_MIN };

export function checkPseudo(pseudo: string): string | null {
  if (pseudo.length < PSEUDO_MIN) return `${PSEUDO_MIN} caractères au moins.`;
  if (!isValidPseudo(pseudo))
    return "Lettres sans accent, chiffres, espaces et ponctuation simple.";
  if (RESERVED_PSEUDO.test(pseudo)) return "Ce pseudo est réservé.";
  return null;
}
