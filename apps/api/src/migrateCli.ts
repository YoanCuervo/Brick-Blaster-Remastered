import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { ConfigError, loadConfig } from "./config";
import { connectionOptions } from "./db";
import { type MigrationSql, migrate } from "./migrate";

/** Built to dist/migrate.js: the SQL files sit next to dist/. */
const MIGRATIONS = fileURLToPath(new URL("../migrations/", import.meta.url));

let config;
try {
  config = loadConfig(process.env);
} catch (error: unknown) {
  if (!(error instanceof ConfigError)) throw error;
  console.error(error.message);
  process.exit(1);
}

// Only this connection runs whole files: the API pool keeps one statement per query.
const connection = await mysql.createConnection({
  ...connectionOptions(config.db),
  multipleStatements: true,
});
const sql: MigrationSql = {
  async run(text, values) {
    await connection.query(text, values && [...values]);
  },
  async names(text) {
    const [rows] = await connection.query<mysql.RowDataPacket[]>(text);
    return rows.map((row) => String(row["name"]));
  },
};

try {
  const applied = await migrate(sql, MIGRATIONS);
  console.log(applied.length > 0 ? `applied: ${applied.join(", ")}` : "schema up to date");
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await connection.end();
}
