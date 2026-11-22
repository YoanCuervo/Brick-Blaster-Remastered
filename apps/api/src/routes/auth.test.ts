import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "../auth/sessions";
import { PASSWORD, call, cookieOf, signedIn, tokenMailedTo } from "../testing/helpers";
import { SITE_URL, testApp } from "../testing/testApp";

const EMAIL = "nova@exemple.fr";

describe("sign-up", () => {
  it("creates an unverified account with a provisional pseudo and mails a link", async () => {
    const t = testApp();
    const res = await call(t, "POST", "/auth/sign-up", {
      body: { email: "Nova@Exemple.FR", password: PASSWORD },
    });
    expect(res.statusCode).toBe(202);
    const [user] = [...t.store.users.values()];
    expect(user).toMatchObject({ email: EMAIL, pseudoChosen: false, emailVerifiedAt: null });
    expect(user!.pseudo).toMatch(/^Joueur\d{5,9}$/);
    expect(user!.passwordHash).toMatch(/^scrypt\$10\$8\$1\$/);
    expect(user!.passwordHash).not.toContain(PASSWORD);
    expect(t.mails).toHaveLength(1);
    expect(t.mails[0]!.to).toBe(EMAIL);
    expect(t.mails[0]!.text).toContain(`${SITE_URL}/verification-email?token=`);
  });

  it("refuses a password without 4 kinds of characters, and any extra field", async () => {
    const t = testApp();
    const signUp = (body: object) => call(t, "POST", "/auth/sign-up", { body });
    expect((await signUp({ email: EMAIL, password: "briquebleue99" })).statusCode).toBe(400);
    expect((await signUp({ email: EMAIL, password: "Brique-Ble9" })).statusCode).toBe(400);
    expect((await signUp({ email: "nova", password: PASSWORD })).statusCode).toBe(400);
    expect((await signUp({ email: EMAIL, password: PASSWORD, pseudo: "Nova" })).statusCode).toBe(
      400,
    );
    expect(t.store.users.size).toBe(0);
  });

  it("answers the same for a taken email, and mails its owner instead", async () => {
    const t = testApp();
    await signedIn(t);
    const res = await call(t, "POST", "/auth/sign-up", {
      body: { email: EMAIL, password: "Autre-Brique7" },
    });
    expect(res.statusCode).toBe(202);
    expect(res.body).toBe("{}");
    expect(t.store.users.size).toBe(1);
    expect(t.mails.at(-1)!.subject).toBe("Tu as déjà un compte Brick Blaster");
  });

  it("sends a fresh link to a taken email not yet verified, and kills the old one", async () => {
    const t = testApp();
    await call(t, "POST", "/auth/sign-up", { body: { email: EMAIL, password: PASSWORD } });
    const first = tokenMailedTo(t, EMAIL);
    await call(t, "POST", "/auth/sign-up", { body: { email: EMAIL, password: PASSWORD } });
    const second = tokenMailedTo(t, EMAIL);
    expect(second).not.toBe(first);
    const verify = (token: string) => call(t, "POST", "/auth/verify-email", { body: { token } });
    expect((await verify(first)).json()).toEqual({ error: "invalid_token" });
    expect((await verify(second)).statusCode).toBe(204);
  });

  it("answers before the email is sent, and survives a mailer failure", async () => {
    const t = testApp({ mailer: { send: () => Promise.reject(new Error("Brevo answered 500")) } });
    const res = await call(t, "POST", "/auth/sign-up", {
      body: { email: EMAIL, password: PASSWORD },
    });
    expect(res.statusCode).toBe(202);
  });
});

describe("email verification", () => {
  it("is needed before the first sign-in, which only the right password learns", async () => {
    const t = testApp();
    await call(t, "POST", "/auth/sign-up", { body: { email: EMAIL, password: PASSWORD } });
    const wrong = await call(t, "POST", "/auth/sign-in", {
      body: { email: EMAIL, password: "Mauvais-Pass1" },
    });
    expect(wrong.json()).toEqual({ error: "invalid_credentials" });
    const right = await call(t, "POST", "/auth/sign-in", {
      body: { email: EMAIL, password: PASSWORD },
    });
    expect(right.statusCode).toBe(403);
    expect(right.json()).toEqual({ error: "email_not_verified" });
    expect(cookieOf(right)).toBeNull();
  });

  it("takes a link once, and not after 24 hours", async () => {
    const t = testApp();
    await call(t, "POST", "/auth/sign-up", { body: { email: EMAIL, password: PASSWORD } });
    const token = tokenMailedTo(t, EMAIL);
    const verify = () => call(t, "POST", "/auth/verify-email", { body: { token } });
    t.clock.advance(24 * 3600_000 - 1000);
    expect((await verify()).statusCode).toBe(204);
    expect((await verify()).statusCode).toBe(400);

    await call(t, "POST", "/auth/sign-up", {
      body: { email: "late@exemple.fr", password: PASSWORD },
    });
    const late = tokenMailedTo(t, "late@exemple.fr");
    t.clock.advance(24 * 3600_000);
    const res = await call(t, "POST", "/auth/verify-email", { body: { token: late } });
    expect(res.json()).toEqual({ error: "invalid_token" });
  });

  it("resends a link to an unverified account only, answering the same either way", async () => {
    const t = testApp();
    await call(t, "POST", "/auth/sign-up", { body: { email: EMAIL, password: PASSWORD } });
    const resend = (email: string) =>
      call(t, "POST", "/auth/resend-verification", { body: { email } });
    expect((await resend(EMAIL)).statusCode).toBe(202);
    expect((await resend("ghost@exemple.fr")).statusCode).toBe(202);
    expect(t.mails.map((m) => m.to)).toEqual([EMAIL, EMAIL]);
  });
});

describe("sign-in", () => {
  it("sets a Secure, HttpOnly, SameSite=Strict session cookie and returns the player", async () => {
    const t = testApp();
    await signedIn(t);
    const res = await call(t, "POST", "/auth/sign-in", {
      body: { email: EMAIL, password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ pseudoChosen: false, avatar: null });
    const header = String(res.headers["set-cookie"]);
    expect(header).toMatch(new RegExp(`^${SESSION_COOKIE}=[A-Za-z0-9_-]{43}; `));
    expect(header).toContain("Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Strict");
    // Only the hash of the id is stored.
    const id = cookieOf(res)!;
    expect([...t.store.sessions.keys()].join()).not.toContain(Buffer.from(id).toString("hex"));
  });

  it("is case-blind on the email", async () => {
    const t = testApp();
    await signedIn(t);
    const res = await call(t, "POST", "/auth/sign-in", {
      body: { email: "NOVA@exemple.fr", password: PASSWORD },
    });
    expect(res.statusCode).toBe(200);
  });

  it("locks for 1, 5, then 15 minutes after each 5 failures", async () => {
    const t = testApp();
    await signedIn(t);
    const attempt = (password: string) =>
      call(t, "POST", "/auth/sign-in", { body: { email: EMAIL, password } });
    for (const minutes of [1, 5, 15, 15]) {
      for (let i = 1; i < 5; i++) expect((await attempt("Mauvais-Pass1")).statusCode).toBe(401);
      const fifth = await attempt("Mauvais-Pass1");
      expect(fifth.statusCode).toBe(429);
      expect(fifth.json()).toEqual({ error: "locked", retryAfterSeconds: minutes * 60 });
      // Even the right password waits, untried.
      t.clock.advance(minutes * 60_000 - 1000);
      expect((await attempt(PASSWORD)).json()).toEqual({ error: "locked", retryAfterSeconds: 1 });
      t.clock.advance(1000);
    }
    expect((await attempt(PASSWORD)).statusCode).toBe(200);
    // A success starts over from 1 minute.
    for (let i = 1; i < 5; i++) await attempt("Mauvais-Pass1");
    expect((await attempt("Mauvais-Pass1")).json()).toMatchObject({ retryAfterSeconds: 60 });
  });

  it("locks an email with no account the same way, telling nothing", async () => {
    const t = testApp();
    const attempt = () =>
      call(t, "POST", "/auth/sign-in", { body: { email: "ghost@exemple.fr", password: PASSWORD } });
    for (let i = 1; i < 5; i++)
      expect((await attempt()).json()).toEqual({ error: "invalid_credentials" });
    expect((await attempt()).json()).toEqual({ error: "locked", retryAfterSeconds: 60 });
  });

  it("is capped at 10 requests per IP and per minute", async () => {
    const t = testApp();
    const attempt = (ip: string, n: number) =>
      call(t, "POST", "/auth/sign-in", {
        body: { email: `p${n}@exemple.fr`, password: PASSWORD },
        ip,
      });
    for (let i = 0; i < 10; i++) expect((await attempt("10.0.0.1", i)).statusCode).toBe(401);
    const over = await attempt("10.0.0.1", 10);
    expect(over.statusCode).toBe(429);
    expect(over.json()).toEqual({ error: "too_many_requests" });
    expect(over.headers["retry-after"]).toBe("60");
    expect((await attempt("10.0.0.2", 11)).statusCode).toBe(401);
    t.clock.advance(60_000);
    expect((await attempt("10.0.0.1", 12)).statusCode).toBe(401);
  });
});

describe("sign-out", () => {
  it("ends the session and clears the cookie", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const res = await call(t, "POST", "/auth/sign-out", { cookie });
    expect(res.statusCode).toBe(204);
    expect(cookieOf(res)).toBe("");
    expect(String(res.headers["set-cookie"])).toContain("Max-Age=0");
    expect((await call(t, "GET", "/me", { cookie })).statusCode).toBe(401);
  });
});

describe("a forgotten password", () => {
  it("mails a reset link to an account only, answering the same either way", async () => {
    const t = testApp();
    await signedIn(t);
    const before = t.mails.length;
    const forgot = (email: string) => call(t, "POST", "/auth/forgot-password", { body: { email } });
    expect((await forgot("ghost@exemple.fr")).statusCode).toBe(202);
    expect(t.mails).toHaveLength(before);
    expect((await forgot(EMAIL)).statusCode).toBe(202);
    expect(t.mails.at(-1)!.text).toContain(`${SITE_URL}/nouveau-mot-de-passe?token=`);
  });

  it("is reset once through the link, which signs every device out", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    await call(t, "POST", "/auth/forgot-password", { body: { email: EMAIL } });
    const token = tokenMailedTo(t, EMAIL);
    const reset = (password: string) =>
      call(t, "POST", "/auth/reset-password", { body: { token, password } });
    expect((await reset("weak")).statusCode).toBe(400);
    expect((await reset("Nouvelle-Brique8")).statusCode).toBe(204);
    expect((await reset("Encore-Brique8")).json()).toEqual({ error: "invalid_token" });
    expect((await call(t, "GET", "/me", { cookie })).statusCode).toBe(401);
    const signIn = (password: string) =>
      call(t, "POST", "/auth/sign-in", { body: { email: EMAIL, password } });
    expect((await signIn(PASSWORD)).statusCode).toBe(401);
    expect((await signIn("Nouvelle-Brique8")).statusCode).toBe(200);
  });

  it("has a link that dies after an hour", async () => {
    const t = testApp();
    await signedIn(t);
    await call(t, "POST", "/auth/forgot-password", { body: { email: EMAIL } });
    t.clock.advance(3600_000);
    const res = await call(t, "POST", "/auth/reset-password", {
      body: { token: tokenMailedTo(t, EMAIL), password: "Nouvelle-Brique8" },
    });
    expect(res.json()).toEqual({ error: "invalid_token" });
  });

  it("verifies the email of an account that never followed its first link", async () => {
    const t = testApp();
    await call(t, "POST", "/auth/sign-up", { body: { email: EMAIL, password: PASSWORD } });
    await call(t, "POST", "/auth/forgot-password", { body: { email: EMAIL } });
    await call(t, "POST", "/auth/reset-password", {
      body: { token: tokenMailedTo(t, EMAIL), password: "Nouvelle-Brique8" },
    });
    const res = await call(t, "POST", "/auth/sign-in", {
      body: { email: EMAIL, password: "Nouvelle-Brique8" },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("account activity, for the purge of inactive accounts", () => {
  const userOf = (t: ReturnType<typeof testApp>) => [...t.store.users.values()][0]!;

  it("starts at sign-up and moves at sign-in", async () => {
    const t = testApp();
    await call(t, "POST", "/auth/sign-up", { body: { email: EMAIL, password: PASSWORD } });
    expect(userOf(t).lastActiveAt).toEqual(t.clock.now);
    await call(t, "POST", "/auth/verify-email", { body: { token: tokenMailedTo(t, EMAIL) } });
    t.clock.advance(5 * 24 * 3600_000);
    await call(t, "POST", "/auth/sign-in", { body: { email: EMAIL, password: PASSWORD } });
    expect(userOf(t).lastActiveAt).toEqual(t.clock.now);
  });

  it("moves with the session at most once an hour, and forgets a warning", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const signedInAt = t.clock.now;
    userOf(t).inactivityWarnedAt = signedInAt;
    t.clock.advance(3600_000 - 1);
    await call(t, "GET", "/me", { cookie });
    expect(userOf(t).lastActiveAt).toEqual(signedInAt);
    expect(userOf(t).inactivityWarnedAt).toEqual(signedInAt);
    t.clock.advance(1);
    await call(t, "GET", "/me", { cookie });
    expect(userOf(t).lastActiveAt).toEqual(t.clock.now);
    expect(userOf(t).inactivityWarnedAt).toBeNull();
  });

  it("moves when the password is reset through the link", async () => {
    const t = testApp();
    await signedIn(t);
    userOf(t).inactivityWarnedAt = t.clock.now;
    t.clock.advance(24 * 3600_000);
    await call(t, "POST", "/auth/forgot-password", { body: { email: EMAIL } });
    await call(t, "POST", "/auth/reset-password", {
      body: { token: tokenMailedTo(t, EMAIL), password: "Nouvelle-Brique8" },
    });
    expect(userOf(t).lastActiveAt).toEqual(t.clock.now);
    expect(userOf(t).inactivityWarnedAt).toBeNull();
  });
});
