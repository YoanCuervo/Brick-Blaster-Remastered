import { describe, expect, it } from "vitest";
import { serializeError } from "./logRedaction";
import { testApp } from "./testing/testApp";

const EMAIL = "leak@test.invalid";
const DUPLICATE = `Duplicate entry '${EMAIL}' for key 'users.users_email'`;

/** Shaped like the errors mysql2 rejects with on a server error. */
function duplicateEntry(): Error {
  return Object.assign(new Error(DUPLICATE), {
    code: "ER_DUP_ENTRY",
    errno: 1062,
    sqlState: "23000",
    sqlMessage: DUPLICATE,
    sql: "INSERT INTO users (email) VALUES (?)",
  });
}

function loggedApp() {
  const lines: string[] = [];
  const { app } = testApp({
    logger: { level: "info", stream: { write: (line: string) => void lines.push(line) } },
  });
  return { app, log: () => lines.join("") };
}

function expectNoLeak(log: string) {
  for (const leak of [EMAIL, "Duplicate entry", "INSERT INTO", "sqlMessage"]) {
    expect(log).not.toContain(leak);
  }
}

describe("a MySQL error in the server log", () => {
  it("keeps its code and stack frames, never its message, from a route", async () => {
    const { app, log } = loggedApp();
    app.get("/api/boom", async () => {
      throw duplicateEntry();
    });
    const res = await app.inject({ method: "GET", url: "/api/boom" });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "internal" });
    expectNoLeak(log());
    const line = JSON.parse(
      log()
        .split("\n")
        .find((l) => l.includes('"err"'))!,
    );
    expect(line.msg).toBe("database error");
    expect(line.err).toMatchObject({ code: "ER_DUP_ENTRY", errno: 1062, sqlState: "23000" });
    expect(line.err.message).toBeUndefined();
    expect(line.err.stack).toMatch(/^Error: \[MySQL ER_DUP_ENTRY\]\n\s+at /);
  });

  it("stays out of the log when Fastify's own error log takes over", async () => {
    const { app, log } = loggedApp();
    const error = duplicateEntry();
    // The app's error handler throws while reading it: Fastify falls back on its default one,
    // which logs the error's message as the line's message.
    Object.defineProperty(error, "validation", {
      get() {
        throw error;
      },
    });
    app.get("/api/boom", async () => {
      throw error;
    });
    const res = await app.inject({ method: "GET", url: "/api/boom" });

    expect(res.statusCode).toBe(500);
    expect(log()).toContain("ER_DUP_ENTRY");
    expectNoLeak(log());
  });

  it("stays out of the log as the cause of another error, or within an AggregateError", () => {
    const { app, log } = loggedApp();
    const wrapped = new Error(`saving failed: ${DUPLICATE}`, { cause: duplicateEntry() });
    app.log.error(wrapped, "cleanup failed");
    app.log.error(wrapped);
    app.log.error({ err: new AggregateError([new Error("other"), duplicateEntry()], "both") });
    app.log.error({ error: duplicateEntry(), msg: DUPLICATE });
    app.log.warn({ err: duplicateEntry() }, "%s happened", DUPLICATE);

    expect(log()).toContain('"msg":"cleanup failed"');
    expect(log()).toContain("saving failed: [redacted]");
    expect(log()).toContain('"msg":"[redacted] happened"');
    expect(log()).toContain('"message":"other"');
    const lines = log().trim().split("\n");
    expect(lines).toHaveLength(5);
    for (const line of lines) expect(line).toContain('"code":"ER_DUP_ENTRY"');
    expectNoLeak(log());
  });

  it("is told apart from other errors, which keep their message", async () => {
    const { app, log } = loggedApp();
    app.get("/api/boom", async () => {
      throw Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3306"), {
        code: "ECONNREFUSED",
        secret: "never written",
      });
    });
    await app.inject({ method: "GET", url: "/api/boom" });

    expect(log()).toContain('"msg":"connect ECONNREFUSED 127.0.0.1:3306"');
    expect(log()).toContain('"code":"ECONNREFUSED"');
    expect(log()).not.toContain("never written");
  });
});

describe("the error serializer", () => {
  it("survives a cycle of causes", () => {
    const a: Error & { cause?: unknown } = new Error("a");
    a.cause = new Error("b", { cause: a });
    expect(serializeError(a)).toMatchObject({ message: "a", cause: { message: "b" } });
  });

  it("leaves what is not an error as it is", () => {
    expect(serializeError("text")).toBe("text");
  });
});
