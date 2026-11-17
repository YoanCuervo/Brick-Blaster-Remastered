import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Db } from "./db";
import { healthRoutes } from "./routes/health";

/** Requests carry small JSON only; replay logs will raise this on their own route. */
export const BODY_LIMIT = 16 * 1024;

export interface AppOptions {
  db: Db;
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
  app.setNotFoundHandler((_req, res) => res.code(404).send({ error: "not_found" }));

  app.register(
    async (api) => {
      healthRoutes(api, options.db);
    },
    { prefix: "/api" },
  );
  return app;
}
