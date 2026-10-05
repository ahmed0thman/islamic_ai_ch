import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

/** The schema the retrieval tables live in. Tests use `rag_test`. */
export function schemaName(): string {
  const name = process.env.HUDA_RAG_SCHEMA || "rag";
  if (!/^[a-z_][a-z0-9_]{0,40}$/.test(name)) throw new Error("invalid schema name");
  return name;
}

/** The SQL files are written for the schema `rag`; another name replaces every `rag.` prefix and the CREATE SCHEMA statement. */
export function withSchema(sql: string, schema: string): string {
  if (!/^[a-z_][a-z0-9_]{0,40}$/.test(schema)) throw new Error("invalid schema name");
  return schema === "rag" ? sql : sql.replace(/\brag\./g, `${schema}.`).replace(/CREATE SCHEMA IF NOT EXISTS rag;/, `CREATE SCHEMA IF NOT EXISTS ${schema};`);
}

const sqlCache = new Map<string, string>();
/** Reads a file of app/db (relative to the app folder, where the server and the scripts run) once. */
export function loadSql(name: string): string {
  let sql = sqlCache.get(name);
  if (sql === undefined) { sql = readFileSync(path.join(process.cwd(), "db", name), "utf8"); sqlCache.set(name, sql); }
  return sql;
}

const pools = new Map<string, pg.Pool>();
/** One pool per connection string (three connections at most); `null` when `DATABASE_URL` is not set. The string is never logged. */
export function getPool(connectionString = process.env.DATABASE_URL): pg.Pool | null {
  if (!connectionString) return null;
  let pool = pools.get(connectionString);
  if (!pool) {
    pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 1500, idleTimeoutMillis: 10_000, statement_timeout: 2000, allowExitOnIdle: true });
    pool.on("error", () => undefined);
    pools.set(connectionString, pool);
  }
  return pool;
}
