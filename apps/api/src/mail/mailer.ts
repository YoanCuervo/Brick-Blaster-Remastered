import type { MailConfig } from "../config";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

interface Log {
  info(message: string): void;
}

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const SENDER_NAME = "Brick Blaster";
const TIMEOUT_MS = 10_000;

export class MailError extends Error {}

/**
 * Brevo's transactional email API (docs/cadrage.md, Stack V2). Open and click tracking are
 * account settings of Brevo, to be turned off there: nothing here can do it.
 */
export function brevoMailer(apiKey: string, from: string, fetcher: typeof fetch = fetch): Mailer {
  return {
    async send(mail) {
      const res = await fetcher(BREVO_URL, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: SENDER_NAME, email: from },
          to: [{ email: mail.to }],
          subject: mail.subject,
          textContent: mail.text,
          htmlContent: mail.html,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // The status is enough to investigate; the body could echo the address back.
      if (!res.ok) throw new MailError(`Brevo answered ${res.status}`);
    },
  };
}

/** Local development only (see loadConfig): the email, link included, goes to the console. */
export function logMailer(log: Log): Mailer {
  return {
    async send(mail) {
      log.info(`email to ${mail.to}: ${mail.subject}\n${mail.text}`);
    },
  };
}

export function createMailer(config: MailConfig, log: Log): Mailer {
  return config.transport === "brevo" ? brevoMailer(config.apiKey, config.from) : logMailer(log);
}
