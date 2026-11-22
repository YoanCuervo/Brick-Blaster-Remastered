import { describe, expect, it } from "vitest";
import {
  INACTIVE_KEEP_MS,
  INACTIVITY_NOTICE_MS,
  UNWARNED_GRACE_MS,
  WARNINGS_PER_RUN,
  cleanupCutoffs,
} from "../cleanup";
import type { Mail, Mailer } from "../mail/mailer";
import { memoryAccounts } from "../testing/memoryAccounts";
import { inactivityWarner } from "./inactivity";

const DAY_MS = 24 * 3600_000;
const SITE = "http://localhost:5174";
const START = new Date("2026-11-22T10:00:00Z");

function setup(mailer?: Mailer) {
  const store = memoryAccounts();
  const mails: Mail[] = [];
  const warn = inactivityWarner(
    store,
    mailer ?? { send: async (mail) => void mails.push(mail) },
    SITE,
  );
  /** One hourly run of the purge, `ms` after START. */
  const runAt = async (ms: number) => {
    const cutoffs = cleanupCutoffs(new Date(START.getTime() + ms));
    await warn(cutoffs);
    await store.cleanup(cutoffs);
  };
  const account = async (name: string, verified = true) => {
    const created = await store.createUser({
      email: `${name}@exemple.fr`,
      passwordHash: "h",
      pseudo: name,
      createdAt: START,
    });
    if (!("id" in created)) throw new Error("not created");
    if (verified) await store.markEmailVerified(created.id, START);
    return created.id;
  };
  return { store, mails, runAt, account };
}

const WARN_AT = INACTIVE_KEEP_MS - INACTIVITY_NOTICE_MS;

describe("inactive accounts", () => {
  it("are kept 3 calendar years at least, leap day included", () => {
    for (let day = 0; day < 4 * 366; day++) {
      const from = new Date(Date.UTC(2026, 0, 1) + day * DAY_MS);
      const threeYears = new Date(from);
      threeYears.setUTCFullYear(from.getUTCFullYear() + 3);
      expect(from.getTime() + INACTIVE_KEEP_MS).toBeGreaterThanOrEqual(threeYears.getTime());
    }
  });

  it("are warned once, a month before, then deleted 30 days after the warning", async () => {
    const t = setup();
    const id = await t.account("nova");
    await t.runAt(WARN_AT - 3600_000);
    expect(t.mails).toHaveLength(0);

    await t.runAt(WARN_AT);
    expect(t.mails).toHaveLength(1);
    const mail = t.mails[0]!;
    expect(mail.to).toBe("nova@exemple.fr");
    // START + 1 096 days, and the warning went out 30 days before.
    expect(mail.subject).toBe("Ton compte Brick Blaster sera supprimé le 22 novembre 2029");
    expect(mail.text).toContain("d'ici le 22 novembre 2029");
    expect(mail.text).toContain(`Me connecter : ${SITE}/connexion`);
    expect(mail.html).toContain(`href="${SITE}/connexion"`);

    await t.runAt(WARN_AT + 3600_000);
    await t.runAt(INACTIVE_KEEP_MS - 3600_000);
    expect(t.mails).toHaveLength(1);
    expect(t.store.users.has(id)).toBe(true);

    await t.runAt(INACTIVE_KEEP_MS);
    expect(t.store.users.has(id)).toBe(false);
  });

  it("keep 30 days of notice when the warning goes out late", async () => {
    const t = setup();
    const id = await t.account("nova");
    const late = INACTIVE_KEEP_MS + 10 * DAY_MS;
    await t.runAt(late);
    expect(t.mails).toHaveLength(1);
    expect(t.store.users.has(id)).toBe(true);
    await t.runAt(late + INACTIVITY_NOTICE_MS - 3600_000);
    expect(t.store.users.has(id)).toBe(true);
    await t.runAt(late + INACTIVITY_NOTICE_MS);
    expect(t.store.users.has(id)).toBe(false);
  });

  it("are kept, and their warning forgotten, when the player comes back", async () => {
    const t = setup();
    const id = await t.account("nova");
    await t.runAt(WARN_AT);
    expect(t.store.users.get(id)!.inactivityWarnedAt).not.toBeNull();

    const back = new Date(START.getTime() + WARN_AT + DAY_MS);
    await t.store.markActive(id, back);
    expect(t.store.users.get(id)!.inactivityWarnedAt).toBeNull();
    await t.runAt(INACTIVE_KEEP_MS + 3600_000);
    expect(t.store.users.has(id)).toBe(true);

    // A second absence brings a second warning.
    await t.runAt(WARN_AT + DAY_MS + WARN_AT);
    expect(t.mails).toHaveLength(2);
  });

  it("never warn nor keep an account whose email was never verified", async () => {
    const t = setup();
    const id = await t.account("ghost", false);
    await t.runAt(8 * DAY_MS);
    expect(t.store.users.has(id)).toBe(false);
    expect(t.mails).toHaveLength(0);
  });

  it("try a failed warning again, without the address in the error", async () => {
    let up = false;
    const sent: Mail[] = [];
    const t = setup({
      async send(mail) {
        if (!up) throw new Error("Brevo answered 503");
        sent.push(mail);
      },
    });
    const id = await t.account("nova");
    const run = t.runAt(WARN_AT);
    await expect(run).rejects.toThrow("1 inactivity warning(s) not sent: Brevo answered 503");
    await run.catch((error: Error) => expect(error.message).not.toContain("nova@"));
    expect(t.store.users.get(id)!.inactivityWarnedAt).toBeNull();

    up = true;
    await t.runAt(WARN_AT + 3600_000);
    expect(sent).toHaveLength(1);
    expect(t.store.users.get(id)!.inactivityWarnedAt).not.toBeNull();
  });

  it("delete an account 2 months past the 3 years when no warning could go out", async () => {
    const t = setup({
      async send() {
        throw new Error("Brevo answered 401");
      },
    });
    const id = await t.account("nova");
    const runQuietly = (ms: number) => t.runAt(ms).catch(() => undefined);
    // The purge after the warnings, as startCleanup runs them side by side.
    const purgeAt = (ms: number) => t.store.cleanup(cleanupCutoffs(new Date(START.getTime() + ms)));
    await runQuietly(WARN_AT);
    await purgeAt(INACTIVE_KEEP_MS + UNWARNED_GRACE_MS - 3600_000);
    expect(t.store.users.has(id)).toBe(true);
    await purgeAt(INACTIVE_KEEP_MS + UNWARNED_GRACE_MS);
    expect(t.store.users.has(id)).toBe(false);
  });

  it("are warned 10 per hour at most, the oldest first", async () => {
    const t = setup();
    const ids: number[] = [];
    for (let i = 0; i < WARNINGS_PER_RUN + 2; i++) {
      const id = await t.account(`p${i}`);
      // p0 is the most recently active.
      await t.store.markActive(id, new Date(START.getTime() + (WARNINGS_PER_RUN + 2 - i) * 1000));
      ids.push(id);
    }
    await t.runAt(WARN_AT + DAY_MS);
    expect(t.mails).toHaveLength(WARNINGS_PER_RUN);
    expect(t.mails.map((m) => m.to)).not.toContain("p0@exemple.fr");
    expect(t.mails.map((m) => m.to)).not.toContain("p1@exemple.fr");
    await t.runAt(WARN_AT + DAY_MS + 3600_000);
    expect(t.mails).toHaveLength(WARNINGS_PER_RUN + 2);
  });
});
