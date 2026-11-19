import { randomInt } from "node:crypto";

/** « Joueur » and up to 9 digits: 15 characters, the pseudo limit (docs/cadrage.md, Comptes). */
export const provisionalPseudo = (): string => `Joueur${randomInt(10_000, 1_000_000_000)}`;

/*
 * The insult filter. Pseudos are ASCII only (contracts, PSEUDO_PATTERN), so digits and symbols
 * standing for letters are folded first. Long words are found anywhere in the pseudo; short
 * ones only as a whole word, else « constant » or « assassin » would be refused.
 */
// prettier-ignore
const FOLD: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", $: "s",
};

// prettier-ignore
const ANYWHERE = [
  "connard", "connasse", "salope", "encule", "batard", "putain", "pouffiasse", "pedale",
  "tapette", "bougnoul", "youpin", "nazi", "hitler", "fuck", "bitch", "whore", "nigger",
  "nigga", "faggot", "asshole", "dickhead", "pussy", "bastard", "slut", "violeur", "pedophile",
  "couille", "branleur", "branleuse", "merdeux",
];
// « montenegro », « therapist », « scunthorpe », « habite », « torpedo »…
// prettier-ignore
const WHOLE_WORD = [
  "con", "conne", "pute", "cul", "merde", "ass", "dick", "cock", "shit", "fag", "negro",
  "negre", "rapist", "cunt", "retard", "bite", "pedo", "fdp", "ntm", "tg", "chienne",
];

export function isRefusedPseudo(pseudo: string): boolean {
  const folded = pseudo.toLowerCase().replace(/[0-9$]/g, (c) => FOLD[c] ?? c);
  const squeezed = folded.replace(/[^a-z]/g, "");
  if (ANYWHERE.some((word) => squeezed.includes(word))) return true;
  const words = folded.split(/[^a-z]+/).filter(Boolean);
  return words.some((word) => WHOLE_WORD.includes(word));
}
