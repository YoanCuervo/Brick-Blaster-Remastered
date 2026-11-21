import { KEPT_RANKS, SHOWN_RANKS } from "@brick-blaster/contracts";
import { describe, expect, it } from "vitest";
import { newToken, sha256 } from "../auth/tokens";
import { TRIAL_COOKIE, TRIAL_TTL_MS } from "../auth/trial";
import { STARTED_KEEP_MS, cleanupCutoffs } from "../cleanup";
import { ReplayRefused } from "../replay/pool";
import { PASSWORD, call, cookieOf, setCookie, signedIn, tokenMailedTo } from "../testing/helpers";
import { DEFAULT_OUTCOME, type TestApp, testApp } from "../testing/testApp";

const ONE_MINUTE = 60_000;
const ranked = { world: "limbes", difficulty: 1, ranked: true } as const;

/** A signed-in player made straight in the store: sign-ups are limited per IP. */
async function sessionFor(t: TestApp, n: number): Promise<string> {
  const created = await t.store.createUser({
    email: `p${n}@exemple.fr`,
    passwordHash: "unused",
    pseudo: `Pilote${n}`,
    createdAt: t.clock.now,
  });
  if (!("id" in created)) throw new Error("not created");
  const id = newToken();
  await t.store.createSession({
    idHash: sha256(id),
    userId: created.id,
    createdAt: t.clock.now,
    lastSeenAt: t.clock.now,
    expiresAt: new Date(t.clock.now.getTime() + 3600_000),
  });
  return id;
}

async function start(t: TestApp, cookie: string, body: object = ranked) {
  const res = await call(t, "POST", "/games", { cookie, body });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: number; seed: number }>();
}

/** Sends a log for the game; the fake replay decides its outcome. */
const send = (
  t: TestApp,
  game: { id: number; seed: number },
  auth: { cookie?: string; trial?: string; ip?: string },
) =>
  call(t, "POST", `/games/${game.id}/log`, {
    ...auth,
    body: { version: 1, seed: game.seed, ops: [[6000, 0, 0]] },
  });

/** Starts a game, lets a long enough time pass, and has the replay find `score`. */
async function play(t: TestApp, cookie: string, score: number, body: object = ranked) {
  const game = await start(t, cookie, body);
  t.clock.advance(5 * ONE_MINUTE);
  t.replay = async () => ({ ...DEFAULT_OUTCOME, score });
  const res = await send(t, game, { cookie });
  expect(res.statusCode).toBe(200);
  return res.json<{ rank: number | null; score: number }>();
}

describe("starting a game", () => {
  it("needs a session, and gives a seed of the server's", async () => {
    const t = testApp();
    expect((await call(t, "POST", "/games", { body: ranked })).statusCode).toBe(401);
    const cookie = await signedIn(t);
    const game = await start(t, cookie);
    expect(game.seed).toBe(t.seeds[0]);
    expect(t.games.games.get(game.id)).toMatchObject({ status: "started", ranked: true });
  });

  it("only ranks the Limbes, and refuses unknown fields", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const bad = (body: object) => call(t, "POST", "/games", { cookie, body });
    expect((await bad({ world: "espace", difficulty: 0, ranked: true })).statusCode).toBe(400);
    expect((await bad({ ...ranked, difficulty: 3 })).statusCode).toBe(400);
    expect((await bad({ ...ranked, score: 999 })).statusCode).toBe(400);
    expect((await bad({ ...ranked, world: "space" })).statusCode).toBe(400);
  });

  it("drops the player's game still waiting for its log", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const first = await start(t, cookie);
    await start(t, cookie);
    expect(t.games.games.has(first.id)).toBe(false);
  });
});

describe("sending a game's log", () => {
  it("keeps the replay's result only, and counts it for the player", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const game = await start(t, cookie, { world: "arcade", difficulty: 2, ranked: false });
    t.clock.advance(5 * ONE_MINUTE);
    const res = await send(t, game, { cookie });
    expect(res.json()).toEqual({
      kind: "game_over",
      score: 12_000,
      level: 3,
      durationSeconds: 100,
      rank: null,
    });
    const profile = (await call(t, "GET", "/me/profile", { cookie })).json();
    expect(profile.counters).toEqual({
      gamesPlayed: 1,
      playSeconds: 100,
      maxLevel: 3,
      livesLost: 3,
      bricksBroken: 140,
    });
    expect(profile.best.arcade).toEqual([null, null, 12_000]);
    expect(profile.games).toEqual([
      {
        playedAt: t.clock.now.toISOString(),
        world: "arcade",
        difficulty: 2,
        ranked: false,
        score: 12_000,
        level: 3,
        durationSeconds: 100,
      },
    ]);
  });

  it("closes the game: a second log is refused", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const game = await start(t, cookie);
    t.clock.advance(5 * ONE_MINUTE);
    expect((await send(t, game, { cookie })).statusCode).toBe(200);
    expect((await send(t, game, { cookie })).json()).toEqual({ error: "game_closed" });
  });

  it("refuses a log the replay refuses, and drops the game", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const game = await start(t, cookie);
    t.clock.advance(5 * ONE_MINUTE);
    t.replay = async () => {
      throw new ReplayRefused("input in pause");
    };
    const res = await send(t, game, { cookie });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: "replay_refused" });
    expect(t.games.games.has(game.id)).toBe(false);
  });

  it("refuses a log of another seed, or with more ticks than the time it had", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const game = await start(t, cookie);
    const res = await call(t, "POST", `/games/${game.id}/log`, {
      cookie,
      body: { version: 1, seed: game.seed + 1, ops: [] },
    });
    expect(res.statusCode).toBe(422);

    const quick = await start(t, cookie);
    // 6 000 ticks are 100 seconds: they cannot fit in one minute.
    t.clock.advance(ONE_MINUTE);
    expect((await send(t, quick, { cookie })).statusCode).toBe(422);
  });

  it("hides the games of others", async () => {
    const t = testApp();
    const owner = await signedIn(t);
    const other = await signedIn(t, "kasso@exemple.fr");
    const game = await start(t, owner);
    t.clock.advance(5 * ONE_MINUTE);
    expect((await send(t, game, { cookie: other })).statusCode).toBe(404);
    expect((await send(t, game, {})).statusCode).toBe(404);
    expect((await send(t, { ...game, id: 999 }, { cookie: owner })).statusCode).toBe(404);
  });

  it("answers busy while every replay slot and the queue are taken", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const waiting: (() => void)[] = [];
    t.replay = () => new Promise((resolve) => waiting.push(() => resolve(DEFAULT_OUTCOME)));
    // Each player sends one log: 2 run, 20 wait, the next is turned away.
    const players = [cookie];
    for (let i = 1; i < 23; i++) players.push(await sessionFor(t, i));
    const games = await Promise.all(players.map((c) => start(t, c)));
    t.clock.advance(5 * ONE_MINUTE);
    const sent = games.map((g, i) => send(t, g, { cookie: players[i]!, ip: `10.0.0.${i}` }));
    while (waiting.length < 2) await new Promise((r) => setTimeout(r, 1));
    const last = await Promise.race(sent);
    expect(last.statusCode).toBe(503);
    expect(last.headers["retry-after"]).toBe("5");
    while (waiting.length > 0) {
      waiting.shift()!();
      await new Promise((r) => setTimeout(r, 1));
    }
    const codes = (await Promise.all(sent)).map((r) => r.statusCode);
    expect(codes.filter((c) => c === 200)).toHaveLength(22);
  });

  it("is limited per IP", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const game = await start(t, cookie);
    const codes = [];
    for (let i = 0; i < 11; i++) codes.push((await send(t, game, { cookie })).statusCode);
    expect(codes.at(-1)).toBe(429);
  });
});

describe("the Limbes leaderboard", () => {
  it("ranks every ranked game, the player's own line apart", async () => {
    const t = testApp();
    const nova = await signedIn(t);
    const kasso = await signedIn(t, "kasso@exemple.fr");
    expect((await play(t, nova, 5_000)).rank).toBe(1);
    expect((await play(t, kasso, 9_000)).rank).toBe(1);
    // A tie goes to the earlier game.
    expect((await play(t, kasso, 5_000)).rank).toBe(3);
    // Unranked Limbes and other difficulties stay out.
    await play(t, nova, 99_000, { world: "limbes", difficulty: 1, ranked: false });
    await play(t, nova, 99_000, { ...ranked, difficulty: 2 });

    const board = (await call(t, "GET", "/leaderboard/1", { cookie: nova })).json();
    expect(board.entries.map((e: { score: number }) => e.score)).toEqual([9_000, 5_000, 5_000]);
    expect(board.entries[0]).toMatchObject({ rank: 1, avatar: null, gamesPlayed: 2 });
    expect(board.me).toMatchObject({ rank: 2, score: 5_000, gamesPlayed: 1 });
    expect((await call(t, "GET", "/leaderboard/1")).json().me).toBeNull();
    expect((await call(t, "GET", "/leaderboard/3")).statusCode).toBe(400);

    const profile = (await call(t, "GET", "/me/profile", { cookie: nova })).json();
    expect(profile.ranked).toEqual([
      { rank: null, record: null },
      { rank: 2, record: 5_000 },
      { rank: 1, record: 99_000 },
    ]);
    expect(profile.best.limbes).toEqual([null, 99_000, 99_000]);
  });

  it("shows the top 100, keeps the top 1000 with their logs", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    const games = t.games.games;
    // Ended ranked games put straight in the store: 1000 of them through the routes is slow.
    for (let i = 0; i < KEPT_RANKS; i++) {
      const id = (await t.games.startGame(
        { userId: 1 },
        { ...ranked, seed: i, startedAt: t.clock.now },
      ))!;
      await t.games.endGame(
        id,
        { ...DEFAULT_OUTCOME, score: 10_000 + i, endedAt: t.clock.now },
        Buffer.from("log"),
      );
    }
    expect(t.games.logs.size).toBe(KEPT_RANKS);
    expect((await play(t, cookie, 1)).rank).toBeNull();
    expect(t.games.logs.size).toBe(KEPT_RANKS);
    const lowest = [...games.values()].find((g) => g.outcome?.score === 10_000)!;
    expect((await play(t, cookie, 50_000)).rank).toBe(1);
    expect(t.games.logs.has(lowest.id)).toBe(false);
    const board = (await call(t, "GET", "/leaderboard/1")).json();
    expect(board.entries).toHaveLength(SHOWN_RANKS);
  });

  it("gives the hover card of a ranked player only", async () => {
    const t = testApp();
    const nova = await signedIn(t);
    await call(t, "PUT", "/me/pseudo", { cookie: nova, body: { pseudo: "Nova Krak" } });
    await play(t, nova, 7_000);
    await play(t, nova, 3_000);
    const card = await call(t, "GET", "/players/nova%20krak?difficulty=1");
    expect(card.json()).toEqual({
      pseudo: "Nova Krak",
      avatar: null,
      score: 7_000,
      gamesPlayed: 2,
    });
    expect((await call(t, "GET", "/players/Nova%20Krak?difficulty=0")).statusCode).toBe(404);
    expect((await call(t, "GET", "/players/Personne?difficulty=1")).statusCode).toBe(404);
  });
});

describe("the trial game", () => {
  async function trial(t: TestApp, previous?: string) {
    const res = await call(t, "POST", "/trial", { trial: previous ?? null });
    expect(res.statusCode).toBe(201);
    const id = setCookie(res, TRIAL_COOKIE);
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    return { ...res.json<{ id: number; seed: number }>(), trial: id! };
  }

  it("is space on medium, owned by its cookie, and passes to the account at sign-up", async () => {
    const t = testApp();
    const game = await trial(t);
    expect(t.games.games.get(game.id)).toMatchObject({
      world: "espace",
      difficulty: 1,
      ranked: false,
    });
    t.clock.advance(5 * ONE_MINUTE);
    expect((await send(t, game, {})).statusCode).toBe(404);
    expect((await send(t, game, { trial: game.trial })).json()).toMatchObject({ score: 12_000 });

    const email = "essai@exemple.fr";
    const signUp = await call(t, "POST", "/auth/sign-up", {
      trial: game.trial,
      body: { email, password: PASSWORD },
    });
    expect(signUp.statusCode).toBe(202);
    expect(setCookie(signUp, TRIAL_COOKIE)).toBe("");
    expect(t.games.trials.size).toBe(0);
    await call(t, "POST", "/auth/verify-email", { body: { token: tokenMailedTo(t, email) } });
    const signIn = await call(t, "POST", "/auth/sign-in", { body: { email, password: PASSWORD } });
    const profile = (await call(t, "GET", "/me/profile", { cookie: cookieOf(signIn) })).json();
    expect(profile.best.espace).toEqual([null, 12_000, null]);
    expect(profile.counters.gamesPlayed).toBe(1);
  });

  it("starts over with a new trial, and expires", async () => {
    const t = testApp();
    const first = await trial(t);
    const second = await trial(t, first.trial);
    expect(t.games.games.has(first.id)).toBe(false);
    t.clock.advance(TRIAL_TTL_MS);
    expect((await send(t, second, { trial: second.trial })).statusCode).toBe(404);
    await t.games.cleanup(cleanupCutoffs(t.clock.now));
    expect(t.games.games.size).toBe(0);
  });
});

describe("the purge", () => {
  it("drops the games never sent", async () => {
    const t = testApp();
    const cookie = await signedIn(t);
    await play(t, cookie, 1_000);
    const waiting = await start(t, cookie);
    t.clock.advance(STARTED_KEEP_MS);
    await t.games.cleanup(cleanupCutoffs(t.clock.now));
    expect(t.games.games.has(waiting.id)).toBe(false);
    expect(t.games.games.size).toBe(1);
  });
});
