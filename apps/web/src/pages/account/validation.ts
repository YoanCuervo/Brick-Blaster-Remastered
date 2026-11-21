import { PASSWORD_RULE, isValidEmail, isValidPassword } from "@brick-blaster/contracts";

/** Client-side checks only, for quick feedback: the API validates every field again. */

export { PASSWORD_RULE };

export function checkEmail(value: string): string | null {
  return isValidEmail(value.trim()) ? null : "Email invalide.";
}

export function checkPassword(value: string): string | null {
  return isValidPassword(value) ? null : PASSWORD_RULE;
}

export function checkConfirmation(password: string, confirmation: string): string | null {
  return password === confirmation ? null : "Les mots de passe ne correspondent pas.";
}

/** Moves the focus to the first field in error, in the order of `ids`. */
export function focusFirstError(ids: readonly string[], errors: Record<string, string | null>) {
  const first = ids.find((id) => errors[id]);
  if (first) document.getElementById(first)?.focus();
}
