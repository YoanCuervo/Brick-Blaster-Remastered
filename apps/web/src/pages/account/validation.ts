/** Client-side checks only, for quick feedback: the API validates every field again. */

const PASSWORD_MIN = 12;
// Deliberately loose: the verification link is the real check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_RULE = "12 caractères minimum.";

export function checkEmail(value: string): string | null {
  return EMAIL_PATTERN.test(value.trim()) ? null : "Email invalide.";
}

export function checkPassword(value: string): string | null {
  return value.length >= PASSWORD_MIN ? null : PASSWORD_RULE;
}

export function checkConfirmation(password: string, confirmation: string): string | null {
  return password === confirmation ? null : "Les mots de passe ne correspondent pas.";
}

/** Moves the focus to the first field in error, in the order of `ids`. */
export function focusFirstError(ids: readonly string[], errors: Record<string, string | null>) {
  const first = ids.find((id) => errors[id]);
  if (first) document.getElementById(first)?.focus();
}
