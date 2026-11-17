import type { FastifyInstance } from "fastify";
import type { Db } from "../db";

const reply = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: { status: { type: "string", enum: ["ok", "unavailable"] } },
} as const;

/** Up when the API answers and so does the database; says nothing more about either. */
export function healthRoutes(app: FastifyInstance, db: Db): void {
  app.get("/health", { schema: { response: { 200: reply, 503: reply } } }, async (req, res) => {
    try {
      await db.ping();
      return { status: "ok" };
    } catch (error: unknown) {
      req.log.error(error, "database ping failed");
      return res.code(503).send({ status: "unavailable" });
    }
  });
}
