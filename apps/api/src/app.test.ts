import { describe, expect, it } from "vitest";
import { BODY_LIMIT, buildApp } from "./app";
import type { Db } from "./db";

const db = (up: boolean): Db => ({
  ping: () => (up ? Promise.resolve() : Promise.reject(new Error("ECONNREFUSED 127.0.0.1:3306"))),
  close: () => Promise.resolve(),
});

/** The app plus a route with a strict body, standing in for the routes to come. */
function appWithEcho(up = true) {
  const app = buildApp({ db: db(up) });
  app.post(
    "/api/echo",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: { name: { type: "string", maxLength: 15 } },
        },
      },
    },
    async (req) => req.body,
  );
  app.get("/api/boom", async () => {
    throw new Error("secret detail");
  });
  return app;
}

describe("the health route", () => {
  it("says ok when the database answers", async () => {
    const res = await appWithEcho().inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("says unavailable, and nothing more, when it does not", async () => {
    const res = await appWithEcho(false).inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(503);
    expect(res.body).toBe(JSON.stringify({ status: "unavailable" }));
  });
});

describe("a request", () => {
  const post = (payload: string, type = "application/json") =>
    appWithEcho().inject({
      method: "POST",
      url: "/api/echo",
      payload,
      headers: { "content-type": type },
    });

  it("goes through when it matches its schema", async () => {
    const res = await post(JSON.stringify({ name: "blaster" }));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ name: "blaster" });
  });

  it("is refused with a field the schema does not name", async () => {
    const res = await post(JSON.stringify({ name: "blaster", admin: true }));
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "bad_request" });
  });

  it("is refused with a wrong type, never coerced", async () => {
    expect((await post(JSON.stringify({ name: 42 }))).statusCode).toBe(400);
    expect((await post(JSON.stringify({ name: "x".repeat(16) }))).statusCode).toBe(400);
  });

  it("is refused when malformed, too large or not JSON", async () => {
    expect((await post("{")).json()).toEqual({ error: "bad_request" });
    const big = JSON.stringify({ name: "x".repeat(BODY_LIMIT) });
    expect((await post(big)).json()).toEqual({ error: "too_large" });
    expect((await post("name=x", "application/x-www-form-urlencoded")).json()).toEqual({
      error: "unsupported_media_type",
    });
  });

  it("gets a bare 404 on an unknown path", async () => {
    const res = await appWithEcho().inject({ method: "GET", url: "/api/nothing" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "not_found" });
  });

  it("never sees the cause of a server error", async () => {
    const res = await appWithEcho().inject({ method: "GET", url: "/api/boom" });
    expect(res.statusCode).toBe(500);
    expect(res.body).toBe(JSON.stringify({ error: "internal" }));
  });
});
