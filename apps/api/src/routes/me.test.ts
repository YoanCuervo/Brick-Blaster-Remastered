import * as contracts from "@brick-blaster/contracts";
import * as engine from "@brick-blaster/game/headless";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "../auth/sessions";
import { PASSWORD, call, cookieOf, signedIn } from "../testing/helpers";
import { testApp } from "../testing/testApp";

const DAY = 24 * 3600_000;

describe("the session", () => {
  it("is needed on every /me route", async () => {
    const t = testApp();
    expect((await call(t, "GET", "/me")).json()).toEqual({ error: "unauthorized" });
    expect((await call(t, "GET", "/me", { cookie: "x".repeat(43) })).statusCode).toBe(401);
    const put = await call(t, "PUT", "/me/avatar", { body: { avatar: 1 } });
    expect(put.statusCode).toBe(401);
  });

  it("ignores a malformed cookie", async () => {
    const t = testApp();
    const res = await t.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { cookie: `${SESSION_COOKIE}=../../etc; other=1` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("ends after 7 days without a visit", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    t.clock.advance(7 * DAY - 1000);
    expect((await call(t, "GET", "/me", { cookie })).statusCode).toBe(200);
    t.clock.advance(7 * DAY - 1000);
    expect((await call(t, "GET", "/me", { cookie })).statusCode).toBe(200);
    t.clock.advance(7 * DAY);
    expect((await call(t, "GET", "/me", { cookie })).statusCode).toBe(401);
    expect(t.store.sessions.size).toBe(0);
  });

  it("ends 30 days after sign-in, visits or not", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    for (let day = 1; day < 30; day++) {
      t.clock.advance(DAY);
      expect((await call(t, "GET", "/me", { cookie })).statusCode).toBe(200);
    }
    t.clock.advance(DAY);
    expect((await call(t, "GET", "/me", { cookie })).statusCode).toBe(401);
  });
});

describe("the pseudo", () => {
  it("replaces the provisional one", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const res = await call(t, "PUT", "/me/pseudo", { cookie, body: { pseudo: "Nova Krak!" } });
    expect(res.statusCode).toBe(204);
    expect((await call(t, "GET", "/me", { cookie })).json()).toEqual({
      pseudo: "Nova Krak!",
      pseudoChosen: true,
      avatar: null,
    });
  });

  it("is unique whatever its case, the player's own aside", async () => {
    const t = testApp();
    const nova = await signedIn(t);
    const other = await signedIn(t, "other@exemple.fr");
    await call(t, "PUT", "/me/pseudo", { cookie: nova, body: { pseudo: "NovaKrak" } });
    const taken = await call(t, "PUT", "/me/pseudo", {
      cookie: other,
      body: { pseudo: "NOVAKRAK" },
    });
    expect(taken.statusCode).toBe(409);
    expect(taken.json()).toEqual({ error: "pseudo_taken" });
    const same = await call(t, "PUT", "/me/pseudo", { cookie: nova, body: { pseudo: "novakrak" } });
    expect(same.statusCode).toBe(204);
  });

  it("refuses the provisional pattern and insults", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    for (const pseudo of ["Joueur12345", "C0nnard", "gros con"]) {
      const res = await call(t, "PUT", "/me/pseudo", { cookie, body: { pseudo } });
      expect(res.json()).toEqual({ error: "pseudo_refused" });
    }
  });

  it("keeps to what the game can write", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    for (const pseudo of ["No", "Novä", "nova_krak", " Nova", "x".repeat(16)]) {
      const res = await call(t, "PUT", "/me/pseudo", { cookie, body: { pseudo } });
      expect(res.statusCode).toBe(400);
    }
  });
});

describe("the avatar", () => {
  it("is one of the 10 of the gallery", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    expect((await call(t, "PUT", "/me/avatar", { cookie, body: { avatar: 9 } })).statusCode).toBe(
      204,
    );
    expect((await call(t, "GET", "/me", { cookie })).json()).toMatchObject({ avatar: 9 });
    for (const avatar of [10, -1, 1.5, "2", null]) {
      const res = await call(t, "PUT", "/me/avatar", { cookie, body: { avatar } });
      expect(res.statusCode).toBe(400);
    }
  });
});

describe("the game settings", () => {
  it("have the engine's own bounds", () => {
    expect(contracts.MAX_VOLUME).toBe(engine.MAX_VOLUME);
    expect(contracts.MIN_SENSITIVITY).toBe(engine.MIN_SENSITIVITY);
    expect(contracts.MAX_SENSITIVITY).toBe(engine.MAX_SENSITIVITY);
  });

  it("need a session", async () => {
    const t = testApp();
    expect((await call(t, "GET", "/me/settings")).statusCode).toBe(401);
    const body = { musicVolume: 10, mouseSensitivity: 1 };
    expect((await call(t, "PUT", "/me/settings", { body })).statusCode).toBe(401);
  });

  it("are null, the game's defaults, until the player changes them", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    expect((await call(t, "GET", "/me/settings", { cookie })).json()).toEqual({
      musicVolume: null,
      mouseSensitivity: null,
    });
  });

  it("keep both values, the sensitivity to the hundredth", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    // Position 18 of the game's bar: 0.1 + 18 / 62 × 2.9 = 0.9419…
    const body = { musicVolume: 62, mouseSensitivity: 0.1 + (18 / 62) * 2.9 };
    expect((await call(t, "PUT", "/me/settings", { cookie, body })).statusCode).toBe(204);
    expect((await call(t, "GET", "/me/settings", { cookie })).json()).toEqual({
      musicVolume: 62,
      mouseSensitivity: 0.94,
    });
  });

  it("refuse an unknown field and any value out of the game's range", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const ok = { musicVolume: 32, mouseSensitivity: 0.5 };
    for (const body of [
      {},
      { musicVolume: 32 },
      { ...ok, soundVolume: 32 },
      { ...ok, musicVolume: 65 },
      { ...ok, musicVolume: -1 },
      { ...ok, musicVolume: 1.5 },
      { ...ok, musicVolume: null },
      { ...ok, mouseSensitivity: 0.09 },
      { ...ok, mouseSensitivity: 3.01 },
      { ...ok, mouseSensitivity: "1" },
    ]) {
      expect((await call(t, "PUT", "/me/settings", { cookie, body })).statusCode).toBe(400);
    }
    expect((await call(t, "GET", "/me/settings", { cookie })).json()).toEqual({
      musicVolume: null,
      mouseSensitivity: null,
    });
  });
});

describe("a password change", () => {
  it("needs the current password", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const res = await call(t, "PUT", "/me/password", {
      cookie,
      body: { currentPassword: "Mauvais-Pass1", newPassword: "Nouvelle-Brique8" },
    });
    expect(res.json()).toEqual({ error: "invalid_credentials" });
  });

  it("signs the other devices out and gives this one a new session", async () => {
    const t = testApp();
    const here = await signedIn(t);
    const elsewhere = cookieOf(
      await call(t, "POST", "/auth/sign-in", {
        body: { email: "nova@exemple.fr", password: PASSWORD },
      }),
    )!;
    const res = await call(t, "PUT", "/me/password", {
      cookie: here,
      body: { currentPassword: PASSWORD, newPassword: "Nouvelle-Brique8" },
    });
    expect(res.statusCode).toBe(204);
    const fresh = cookieOf(res)!;
    expect((await call(t, "GET", "/me", { cookie: elsewhere })).statusCode).toBe(401);
    expect((await call(t, "GET", "/me", { cookie: here })).statusCode).toBe(401);
    expect((await call(t, "GET", "/me", { cookie: fresh })).statusCode).toBe(200);
  });
});

describe("deleting the account", () => {
  it("needs SUPPRIMER typed out", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    for (const body of [{}, { confirm: "supprimer" }, { confirm: "SUPPRIMER", now: true }]) {
      expect((await call(t, "DELETE", "/me", { cookie, body })).statusCode).toBe(400);
    }
    expect(t.store.users.size).toBe(1);
  });

  it("removes the account, its sessions and its links", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    await call(t, "POST", "/auth/forgot-password", { body: { email: "nova@exemple.fr" } });
    const res = await call(t, "DELETE", "/me", { cookie, body: { confirm: "SUPPRIMER" } });
    expect(res.statusCode).toBe(204);
    expect(cookieOf(res)).toBe("");
    expect(t.store.users.size + t.store.sessions.size + t.store.tokens.size).toBe(0);
    const again = await call(t, "POST", "/auth/sign-in", {
      body: { email: "nova@exemple.fr", password: PASSWORD },
    });
    expect(again.statusCode).toBe(401);
  });
});
