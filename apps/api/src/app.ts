import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Db } from "./db";
import { authRoutes } from "./routes/auth";
import type { AccountDeps, GameDeps } from "./routes/deps";
import { gameRoutes } from "./routes/games";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import { scoreRoutes } from "./routes/scores";

/** Requests carry small JSON only; replay logs raise this on their own route. */
export const BODY_LIMIT = 16 * 1024;

export interface AppOptions {
  db: Db;
  accounts: AccountDeps;
  games: GameDeps;
  trustProxy?: boolean;
  logger?: FastifyServerOptions["logger"];
}

/** Error bodies name a category, never the cause: details stay in the server log. */
const ERRORS: Record<number, string> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  413: "too_large",
  415: "unsupported_media_type",
  429: "too_many_requests",
};

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: BODY_LIMIT,
    trustProxy: options.trustProxy ?? false,
    ajv: {
      // A field the schema does not name is refused, not quietly dropped.
      customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false },
    },
  });

  app.setErrorHandler((error: { statusCode?: number; validation?: unknown }, req, res) => {
    const code = error.validation ? 400 : (error.statusCode ?? 500);
    if (code >= 500 || !ERRORS[code]) {
      req.log.error(error);
      return res.code(500).send({ error: "internal" });
    }
    return res.code(code).send({ error: ERRORS[code] });
  });
  // Besides SameSite=Strict and JSON-only bodies: a write from another site is refused outright.
  app.addHook("onRequest", async (req, res) => {
    if (req.method === "GET" || req.method === "HEAD") return;
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== options.accounts.siteUrl) {
      return res.code(403).send({ error: "forbidden" });
    }
  });
  app.setNotFoundHandler((_req, res) => res.code(404).send({ error: "not_found" }));

  app.register(
    async (api) => {
      healthRoutes(api, options.db);
      authRoutes(api, options.accounts);
      meRoutes(api, options.accounts);
      gameRoutes(api, options.games);
      scoreRoutes(api, options.games);
    },
    { prefix: "/api" },
  );
  return app;
}
