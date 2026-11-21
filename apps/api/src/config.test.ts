import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config";

const minimal = { DB_USER: "blaster", DB_PASSWORD: "secret", DB_NAME: "brick_blaster" };

const problemsOf = (env: Record<string, string>): readonly string[] => {
  try {
    loadConfig(env);
  } catch (error: unknown) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
  return [];
};

describe("the API configuration", () => {
  it("fills the defaults around the database access", () => {
    expect(loadConfig(minimal)).toEqual({
      host: "127.0.0.1",
      port: 3000,
      trustProxy: false,
      siteUrl: "http://localhost:5174",
      mail: { transport: "log" },
      gameDataDir: "../../assets",
      db: {
        host: "127.0.0.1",
        port: 3306,
        user: "blaster",
        password: "secret",
        database: "brick_blaster",
      },
    });
  });

  it("reads every variable", () => {
    const config = loadConfig({
      ...minimal,
      API_HOST: "0.0.0.0",
      API_PORT: "8080",
      API_TRUST_PROXY: "true",
      DB_HOST: "mysql",
      DB_PORT: "3307",
      GAME_DATA_DIR: "/srv/game",
    });
    expect(config).toMatchObject({ host: "0.0.0.0", port: 8080, trustProxy: true });
    expect(config.db).toMatchObject({ host: "mysql", port: 3307 });
    expect(config.gameDataDir).toBe("/srv/game");
  });

  it("names every missing variable at once", () => {
    expect(problemsOf({})).toEqual([
      "DB_USER is required",
      "DB_PASSWORD is required",
      "DB_NAME is required",
    ]);
  });

  it("refuses bad values", () => {
    expect(problemsOf({ ...minimal, API_PORT: "http" })).toEqual([
      "API_PORT must be a port number",
    ]);
    expect(problemsOf({ ...minimal, DB_PORT: "70000" })).toEqual(["DB_PORT must be a port number"]);
    expect(problemsOf({ ...minimal, API_TRUST_PROXY: "yes" })).toEqual([
      "API_TRUST_PROXY must be true or false",
    ]);
    expect(problemsOf({ ...minimal, DB_NAME: "brick;drop" })).toEqual([
      "DB_NAME may only hold letters, digits and _",
    ]);
  });

  it("never prints a value in its message", () => {
    try {
      loadConfig({ DB_PASSWORD: "hunter2", DB_PORT: "hunter2" });
    } catch (error: unknown) {
      expect((error as Error).message).not.toContain("hunter2");
    }
  });

  it("keeps the origin of the site only", () => {
    expect(loadConfig({ ...minimal, SITE_URL: "http://localhost:5174/" }).siteUrl).toBe(
      "http://localhost:5174",
    );
    expect(problemsOf({ ...minimal, SITE_URL: "ftp://exemple.fr" })).toEqual([
      "SITE_URL must be an http(s) URL",
    ]);
  });

  it("sends emails through Brevo when it has a key", () => {
    const config = loadConfig({
      ...minimal,
      SITE_URL: "https://brickblaster.fr",
      BREVO_API_KEY: "xkeysib-test",
      MAIL_FROM: "noreply@brickblaster.fr",
    });
    expect(config.mail).toEqual({
      transport: "brevo",
      apiKey: "xkeysib-test",
      from: "noreply@brickblaster.fr",
    });
    expect(problemsOf({ ...minimal, BREVO_API_KEY: "xkeysib-test" })).toEqual([
      "MAIL_FROM is required",
    ]);
    expect(problemsOf({ ...minimal, BREVO_API_KEY: "k", MAIL_FROM: "noreply" })).toEqual([
      "MAIL_FROM must be an email address",
    ]);
  });

  it("writes emails to the log on a local site only, and wants HTTPS elsewhere", () => {
    expect(problemsOf({ ...minimal, SITE_URL: "https://brickblaster.fr" })).toEqual([
      "BREVO_API_KEY is required when SITE_URL is not local",
    ]);
    expect(
      problemsOf({
        ...minimal,
        SITE_URL: "http://brickblaster.fr",
        BREVO_API_KEY: "k",
        MAIL_FROM: "a@b.fr",
      }),
    ).toEqual(["SITE_URL must use https"]);
    expect(loadConfig({ ...minimal, SITE_URL: "http://127.0.0.1:5174" }).mail.transport).toBe(
      "log",
    );
  });
});
