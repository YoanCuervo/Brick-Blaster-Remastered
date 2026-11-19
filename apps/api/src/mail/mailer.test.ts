import { describe, expect, it } from "vitest";
import { MailError, brevoMailer, logMailer } from "./mailer";
import { resetPasswordMail, verifyEmailMail } from "./templates";

const MAIL = verifyEmailMail("nova@exemple.fr", "http://localhost:5174/verification-email?token=t");

describe("the Brevo mailer", () => {
  it("posts one transactional email with the key in a header", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{"messageId":"<1@brevo>"}', { status: 201 });
    }) as unknown as typeof fetch;
    await brevoMailer("xkeysib-test", "noreply@brickblaster.fr", fetcher).send(MAIL);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.headers).toMatchObject({ "api-key": "xkeysib-test" });
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      sender: { name: "Brick Blaster", email: "noreply@brickblaster.fr" },
      to: [{ email: "nova@exemple.fr" }],
      subject: MAIL.subject,
      textContent: MAIL.text,
      htmlContent: MAIL.html,
    });
  });

  it("fails on a refusal, naming the status only", async () => {
    const fetcher = (async () =>
      new Response('{"message":"nova@exemple.fr is blocked"}', {
        status: 400,
      })) as unknown as typeof fetch;
    const sending = brevoMailer("k", "a@b.fr", fetcher).send(MAIL);
    await expect(sending).rejects.toThrow(MailError);
    await expect(sending).rejects.toThrow("Brevo answered 400");
  });
});

describe("the log mailer", () => {
  it("writes the email, link included, for local work", async () => {
    const lines: string[] = [];
    await logMailer({ info: (line) => lines.push(line) }).send(MAIL);
    expect(lines[0]).toContain("verification-email?token=t");
  });
});

describe("the email templates", () => {
  it("escape what they put in HTML", () => {
    const mail = resetPasswordMail("a@b.fr", 'http://x/?token=<script>"');
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain("<script>");
  });
});
