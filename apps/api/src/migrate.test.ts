import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfigError, type Config, loadConfig } from "./config";
import { connectionOptions } from "./db";
import { type MigrationSql, migrate } from "./migrate";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "migrations-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const files = async (named: Record<string, string>) => {
  for (const [name, text] of Object.entries(named)) await writeFile(join(dir, name), text);
};

/** Keeps the statements it is given and answers with the names already applied. */
function fakeSql(applied: string[] = []): MigrationSql & { ran: string[] } {
  const ran: string[] = [];
  return {
    ran,
    async run(text, values) {
      ran.push(values ? `${text} ${JSON.stringify(values)}` : text);
    },
    async names() {
      return applied;
    },
  };
}

describe("the migration runner", () => {
  it("applies the new files in order and records each one", async () => {
    await files({ "0002_b.sql": "B;", "0001_a.sql": "A;", "notes.txt": "skipped" });
    const sql = fakeSql();
    expect(await migrate(sql, dir)).toEqual(["0001_a.sql", "0002_b.sql"]);
    expect(sql.ran.slice(1)).toEqual([
      "A;",
      'INSERT INTO schema_migrations (name) VALUES (?) ["0001_a.sql"]',
      "B;",
      'INSERT INTO schema_migrations (name) VALUES (?) ["0002_b.sql"]',
    ]);
  });

  it("skips the files already applied", async () => {
    await files({ "0001_a.sql": "A;", "0002_b.sql": "B;" });
    const sql = fakeSql(["0001_a.sql"]);
    expect(await migrate(sql, dir)).toEqual(["0002_b.sql"]);
    expect(sql.ran).not.toContain("A;");
  });

  it("refuses a badly named file rather than ignoring it", async () => {
    await files({ "0001_a.sql": "A;", "create-users.sql": "X;" });
    await expect(migrate(fakeSql(), dir)).rejects.toThrow(
      "badly named migrations: create-users.sql",
    );
  });

  it("refuses to go on when an applied file is gone", async () => {
    await files({ "0002_b.sql": "B;" });
    await expect(migrate(fakeSql(["0001_a.sql"]), dir)).rejects.toThrow(
      "applied migrations missing: 0001_a.sql",
    );
  });
});

/**
 * Against the MySQL of apps/api/.env, in tables of its own that it drops afterwards. Without a
 * database configured these are skipped, and say so.
 */
const ENV_FILE = new URL("../.env", import.meta.url);
let config: Config | null = null;
try {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  config = loadConfig(process.env);
} catch (error: unknown) {
  if (!(error instanceof ConfigError)) throw error;
  console.warn("MySQL tests skipped: no database configured in apps/api/.env");
}

describe.skipIf(config === null)("the migration runner on MySQL", () => {
  it("creates its table, applies a file of several statements once, then nothing", async () => {
    const connection = await mysql.createConnection({
      ...connectionOptions(config!.db),
      multipleStatements: true,
    });
    const sql: MigrationSql = {
      run: async (text, values) => void (await connection.query(text, values && [...values])),
      names: async (text) => {
        const [rows] = await connection.query<mysql.RowDataPacket[]>(text);
        return rows.map((row) => String(row["name"]));
      },
    };
    const table = "test_schema_migrations";
    await files({
      "0001_pair.sql":
        "CREATE TABLE test_migrate_a (id INT PRIMARY KEY);\n" +
        "CREATE TABLE test_migrate_b (id INT PRIMARY KEY);",
    });
    try {
      expect(await migrate(sql, dir, table)).toEqual(["0001_pair.sql"]);
      expect(await migrate(sql, dir, table)).toEqual([]);
      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM information_schema.tables " +
          "WHERE table_schema = DATABASE() AND table_name IN ('test_migrate_a', 'test_migrate_b')",
      );
      expect(Number(rows[0]!["n"])).toBe(2);
    } finally {
      await connection.query(`DROP TABLE IF EXISTS test_migrate_a, test_migrate_b, ${table}`);
      await connection.end();
    }
  });
});
