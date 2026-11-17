import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/** A file is `0001_create_users.sql`: four digits give the order, the rest names it. */
export const MIGRATION_NAME = /^\d{4}_[a-z0-9_]+\.sql$/;

/** The two calls the runner makes, so that a test can stand in for MySQL. */
export interface MigrationSql {
  /** Runs one file, which may hold several statements. */
  run(sql: string, values?: readonly (string | number)[]): Promise<void>;
  names(sql: string): Promise<string[]>;
}

export class MigrationError extends Error {}

/**
 * Applies, in order, the files of `dir` not yet listed in `table`, and returns their names.
 * MySQL commits each DDL statement on its own: a file that fails halfway needs a hand fix.
 */
export async function migrate(
  sql: MigrationSql,
  dir: string,
  table = "schema_migrations",
): Promise<string[]> {
  if (!/^[a-z_]+$/.test(table)) throw new MigrationError(`bad table name ${table}`);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const odd = files.filter((f) => !MIGRATION_NAME.test(f));
  if (odd.length > 0) throw new MigrationError(`badly named migrations: ${odd.join(", ")}`);

  await sql.run(
    `CREATE TABLE IF NOT EXISTS ${table} (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  );
  const done = new Set(await sql.names(`SELECT name FROM ${table}`));
  // A file removed after it ran would leave the schema out of step with the repository.
  const gone = [...done].filter((name) => !files.includes(name));
  if (gone.length > 0) throw new MigrationError(`applied migrations missing: ${gone.join(", ")}`);

  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    await sql.run(await readFile(join(dir, file), "utf8"));
    await sql.run(`INSERT INTO ${table} (name) VALUES (?)`, [file]);
    applied.push(file);
  }
  return applied;
}
