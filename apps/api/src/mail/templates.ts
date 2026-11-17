import type { Mail } from "./mailer";

/** The French emails of the account flow, in plain text and in simple HTML. */

const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function mail(to: string, subject: string, lines: string[], link?: { url: string; label: string }) {
  const text = [...lines, ...(link ? ["", link.url] : []), "", "— Brick Blaster"].join("\n");
  const paragraphs = lines.map((line) => `<p>${escape(line)}</p>`);
  if (link) {
    paragraphs.push(`<p><a href="${escape(link.url)}">${escape(link.label)}</a></p>`);
    paragraphs.push(`<p style="color:#666;font-size:12px">${escape(link.url)}</p>`);
  }
  const html =
    `<!doctype html><html lang="fr"><body style="font-family:sans-serif">` +
    `${paragraphs.join("")}<p>— Brick Blaster</p></body></html>`;
  return { to, subject, text, html } satisfies Mail;
}

export const verifyEmailMail = (to: string, url: string): Mail =>
  mail(
    to,
    "Confirme ton adresse email",
    [
      "Bienvenue sur Brick Blaster !",
      "Clique sur le lien ci-dessous pour confirmer ton adresse et activer ton compte. Il est valable 24 heures.",
      "Si tu n'as pas créé de compte, ignore cet email : sans confirmation, il sera supprimé.",
    ],
    { url, label: "Confirmer mon adresse" },
  );

/** Sent instead of a new account when the address already has one: the site says nothing. */
export const alreadyRegisteredMail = (to: string, signInUrl: string, resetUrl: string): Mail =>
  mail(to, "Tu as déjà un compte Brick Blaster", [
    "Quelqu'un, sans doute toi, a voulu créer un compte avec cette adresse, qui en a déjà un.",
    `Pour te connecter : ${signInUrl}`,
    `Mot de passe oublié : ${resetUrl}`,
    "Si ce n'était pas toi, ignore cet email : ton compte n'a pas changé.",
  ]);

export const resetPasswordMail = (to: string, url: string): Mail =>
  mail(
    to,
    "Choisis un nouveau mot de passe",
    [
      "Tu as demandé à changer le mot de passe de ton compte Brick Blaster.",
      "Clique sur le lien ci-dessous pour en choisir un nouveau. Il est valable 1 heure et ne sert qu'une fois.",
      "Si tu n'as rien demandé, ignore cet email : ton mot de passe reste le même.",
    ],
    { url, label: "Choisir un nouveau mot de passe" },
  );
