import { buildApp } from "./app";
import { createPasswordHasher } from "./auth/password";
import { startCleanup } from "./cleanup";
import { ConfigError, loadConfig } from "./config";
import { createDb, createPool } from "./db";
import { createMailer } from "./mail/mailer";
import { rateLimits } from "./routes/deps";
import { createMysqlAccountStore } from "./store/accounts";

let config;
try {
  config = loadConfig(process.env);
} catch (error: unknown) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}

const pool = createPool(config.db);
const db = createDb(pool);
const store = createMysqlAccountStore(pool);
const now = () => new Date();
// The app's logger, once the app exists: no email is sent before it listens.
const mailer = createMailer(config.mail, { info: (message) => app.log.info(message) });
const app = buildApp({
  db,
  accounts: {
    store,
    hasher: createPasswordHasher(),
    mailer,
    siteUrl: config.siteUrl,
    now,
    limits: rateLimits(now),
  },
  trustProxy: config.trustProxy,
  logger: { level: "info" },
});
if (config.mail.transport === "log") {
  app.log.warn("no BREVO_API_KEY: emails are written to this log instead of being sent");
}
const stopCleanup = startCleanup(store, now, (error) => app.log.error(error, "cleanup failed"));

async function stop(): Promise<void> {
  stopCleanup();
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
