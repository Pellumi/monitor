import path from "node:path";
import { app, safeStorage } from "electron";

type Statement = {
  run(...values: unknown[]): unknown;
  get(...values: unknown[]): Record<string, unknown> | undefined;
  all(...values: unknown[]): Record<string, unknown>[];
};

type Database = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
};

let database: Database | null = null;

function getDatabase(): Database {
  if (database) return database;
  // Electron 43 ships a Node runtime with the built-in synchronous SQLite API.
  // Keeping the require dynamic avoids coupling renderer compilation to Node APIs.
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (filename: string) => Database;
  };
  database = new DatabaseSync(
    path.join(app.getPath("userData"), "tellann-local.db"),
  );
  database.exec(`
    CREATE TABLE IF NOT EXISTS encrypted_state (
      key TEXT PRIMARY KEY,
      value BLOB NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  return database;
}

export function readLocalState<T>(key: string): T | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const row = getDatabase()
    .prepare("SELECT value FROM encrypted_state WHERE key = ?")
    .get(key);
  if (!row?.value) return null;
  const encrypted = Buffer.isBuffer(row.value)
    ? row.value
    : Buffer.from(row.value as Uint8Array);
  return JSON.parse(safeStorage.decryptString(encrypted)) as T;
}

export function writeLocalState(key: string, value: unknown): void {
  if (!safeStorage.isEncryptionAvailable())
    throw new Error("WINDOWS_PROTECTED_STORAGE_UNAVAILABLE");
  const encrypted = safeStorage.encryptString(JSON.stringify(value));
  getDatabase()
    .prepare(
      `
    INSERT INTO encrypted_state (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `,
    )
    .run(key, encrypted, new Date().toISOString());
}

/**
 * Keys currently held in the encrypted store, optionally restricted to a
 * prefix. Used at startup to find work (such as an interrupted QA evidence
 * synchronization) that a previous session left behind.
 */
export function listLocalStateKeys(prefix = ""): string[] {
  const rows = getDatabase()
    .prepare(
      prefix
        ? "SELECT key FROM encrypted_state WHERE key LIKE ? ESCAPE '\\' ORDER BY updated_at ASC"
        : "SELECT key FROM encrypted_state ORDER BY updated_at ASC",
    )
    .all(...(prefix ? [`${prefix.replace(/[\\%_]/g, "\\$&")}%`] : []));
  return rows
    .map((row) => row.key)
    .filter((key): key is string => typeof key === "string");
}

export function deleteLocalState(key: string): void {
  getDatabase().prepare("DELETE FROM encrypted_state WHERE key = ?").run(key);
}

export function closeLocalStore(): void {
  database?.close();
  database = null;
}
