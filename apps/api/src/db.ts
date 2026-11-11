import mysql from "mysql2/promise";
import type { DbConfig } from "./config";

/** What the routes need from the database: kept small so that tests can stand in for it. */
export interface Db {
  ping(): Promise<void>;
  close(): Promise<void>;
}

export function connectionOptions(config: DbConfig): mysql.ConnectionOptions {
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: "utf8mb4",
    timezone: "Z",
    // Values only ever go through placeholders: no request can add a statement.
    multipleStatements: false,
  };
}

export function createDb(config: DbConfig): Db {
  const pool = mysql.createPool({ ...connectionOptions(config), connectionLimit: 5 });
  return {
    async ping() {
      await pool.query("SELECT 1");
    },
    close: () => pool.end(),
  };
}
