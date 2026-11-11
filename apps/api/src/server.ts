import { buildApp } from "./app";
import { ConfigError, loadConfig } from "./config";
import { createDb } from "./db";

let config;
try {
  config = loadConfig(process.env);
} catch (error: unknown) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}

const db = createDb(config.db);
const app = buildApp({ db, trustProxy: config.trustProxy, logger: { level: "info" } });

async function stop(): Promise<void> {
  await app.close();
  await db.close();
  process.exit(0);
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error: unknown) {
  app.log.error(error);
  await db.close();
  process.exit(1);
}
