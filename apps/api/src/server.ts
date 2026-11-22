import { buildApp } from "./app";
import { createPasswordHasher } from "./auth/password";
import { inactivityWarner } from "./account/inactivity";
import { startCleanup } from "./cleanup";
import { ConfigError, loadConfig } from "./config";
import { createDb, createPool } from "./db";
import { createMailer } from "./mail/mailer";
import { loadGameData } from "./replay/job";
import { workerReplayer } from "./replay/pool";
import { gameRateLimits, rateLimits } from "./routes/deps";
import { newSeed } from "./routes/games";
import { createMysqlAccountStore } from "./store/accounts";
import { createMysqlGameStore } from "./store/games";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
const games = createMysqlGameStore(pool);
const now = () => new Date();
const gameDataDir = resolve(config.gameDataDir);
try {
  // Read once here so that a missing pack stops the start, not the first replay.
  loadGameData(gameDataDir);
} catch (error: unknown) {
  console.error(`GAME_DATA_DIR: no valid config.json and levels.json in ${gameDataDir}`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
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
    trials: games,
  },
  games: {
    store: games,
    accounts: store,
    // vite.config.ts builds the worker next to this file.
    replayer: workerReplayer(gameDataDir, {
      file: join(dirname(fileURLToPath(import.meta.url)), "replayWorker.js"),
    }),
    newSeed,
    now,
    limits: gameRateLimits(now),
  },
  trustProxy: config.trustProxy,
  logger: { level: "info" },
});
if (config.mail.transport === "log") {
  app.log.warn("no BREVO_API_KEY: emails are written to this log instead of being sent");
}
const stopCleanup = startCleanup(
  store,
  games,
  inactivityWarner(store, mailer, config.siteUrl),
  now,
  (error) => app.log.error(error, "cleanup failed"),
);

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
