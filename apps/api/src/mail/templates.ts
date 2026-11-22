import type { Mail } from "./mailer";

/** The French emails of the account flow, in plain text and in HTML. */

const escape = (text: string): string => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Served by the website at a fixed path (apps/web/vite.config.ts). */
export const LOGO_PATH = "/email/logo.png";

const SIGNATURE = ["À très vite sur le terrain,", "L'équipe Brick Blaster"];

// Mail clients ignore stylesheets and web fonts: tables, inline styles and system fonts only.
const FONT = "font-family:Arial,Helvetica,sans-serif";
const COLORS = {
  page: "#0b0b0b",
  card: "#151515",
  border: "#3a3a3a",
  text: "#e8e8e8",
  muted: "#a0a0a0",
  button: "#315edb",
  link: "#f7972f",
};

interface Button {
  url: string;
  label: string;
}

interface Content {
  subject: string;
  heading: string;
  /** Paragraphs before the button. */
  intro: string[];
  button?: Button;
  /** Paragraphs after the button, in smaller type. */
  outro: string[];
  /** Other links, shown under the outro. */
  links?: Button[];
}

function mail(to: string, siteUrl: string, content: Content): Mail {
  const { subject, heading, intro, button, outro, links = [] } = content;

  const text = [
    heading,
    "",
    ...intro,
    ...(button ? ["", `${button.label} : ${button.url}`] : []),
    "",
    ...outro,
    ...links.map((link) => `${link.label} : ${link.url}`),
    "",
    ...SIGNATURE,
  ].join("\n");

  const paragraph = (line: string, size: number, color: string) =>
    `<p style="margin:0 0 16px;${FONT};font-size:${size}px;line-height:1.5;color:${color}">${escape(line)}</p>`;
  const anchor = (link: Button) =>
    `<a href="${escape(link.url)}" style="color:${COLORS.link};text-decoration:underline">${escape(link.label)}</a>`;

  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">` +
      `<tr><td style="background:${COLORS.button}">` +
      `<a href="${escape(button.url)}" style="display:inline-block;padding:14px 28px;${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${escape(button.label)}</a>` +
      `</td></tr></table>` +
      paragraph("Le bouton ne marche pas ? Copie ce lien dans ton navigateur :", 12, COLORS.muted) +
      `<p style="margin:-8px 0 24px;${FONT};font-size:12px;line-height:1.5;word-break:break-all">${anchor({ url: button.url, label: button.url })}</p>`
    : "";

  const body =
    `<h1 style="margin:0 0 16px;${FONT};font-size:24px;line-height:1.3;color:#ffffff">${escape(heading)}</h1>` +
    intro.map((line) => paragraph(line, 16, COLORS.text)).join("") +
    buttonHtml +
    outro.map((line) => paragraph(line, 14, COLORS.muted)).join("") +
    links
      .map((link) => `<p style="margin:0 0 12px;${FONT};font-size:14px">${anchor(link)}</p>`)
      .join("") +
    `<p style="margin:24px 0 0;${FONT};font-size:14px;line-height:1.5;color:${COLORS.text}">` +
    SIGNATURE.map(escape).join("<br>") +
    `</p>`;

  const html =
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:${COLORS.page}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page}">` +
    `<tr><td align="center" style="padding:32px 16px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">` +
    `<tr><td align="center" style="padding:0 0 24px">` +
    `<img src="${escape(siteUrl + LOGO_PATH)}" width="240" alt="Brick Blaster Remastered" style="display:block;width:240px;max-width:100%;height:auto;border:0;${FONT};font-size:20px;font-weight:bold;color:#ffffff">` +
    `</td></tr>` +
    `<tr><td style="padding:32px;background:${COLORS.card};border:1px solid ${COLORS.border}">${body}</td></tr>` +
    `</table></td></tr></table></body></html>`;

  return { to, subject, text, html };
}

export const verifyEmailMail = (to: string, url: string, siteUrl: string): Mail =>
  mail(to, siteUrl, {
    subject: "Bienvenue dans Brick Blaster ! Confirme ton adresse",
    heading: "Salut et bienvenue !",
    intro: [
      "Ton compte est presque prêt. Confirme ton adresse pour garder tes scores, suivre tes stats et grimper au classement des Limbes.",
    ],
    button: { url, label: "Confirmer mon adresse" },
    outro: [
      "Le lien est valable 24 heures. Si tu n'as pas créé de compte, ignore simplement cet email : sans confirmation, il sera supprimé.",
    ],
  });

/** Sent instead of a new account when the address already has one: the site says nothing. */
export const alreadyRegisteredMail = (
  to: string,
  signInUrl: string,
  resetUrl: string,
  siteUrl: string,
): Mail =>
  mail(to, siteUrl, {
    subject: "Tu as déjà un compte Brick Blaster",
    heading: "Content de te revoir !",
    intro: [
      "Quelqu'un, sans doute toi, a voulu créer un compte avec cette adresse. Bonne nouvelle : tu en as déjà un, il t'attend.",
    ],
    button: { url: signInUrl, label: "Me connecter" },
    outro: ["Si ce n'était pas toi, ignore cet email : ton compte n'a pas changé."],
    links: [{ url: resetUrl, label: "Mot de passe oublié ?" }],
  });

export const resetPasswordMail = (to: string, url: string, siteUrl: string): Mail =>
  mail(to, siteUrl, {
    subject: "Choisis un nouveau mot de passe",
    heading: "Pas de panique !",
    intro: [
      "Tu as demandé à changer le mot de passe de ton compte Brick Blaster. Choisis-en un nouveau et reprends la partie là où tu l'as laissée.",
    ],
    button: { url, label: "Choisir un nouveau mot de passe" },
    outro: [
      "Le lien est valable 1 heure et ne sert qu'une fois. Si tu n'as rien demandé, ignore cet email : ton mot de passe reste le même.",
    ],
  });
