import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DomainError } from "@mission-control/domain";
import { runMigrations } from "./migrations.js";

// SQLite via the Node.js built-in driver (decision D-018): no native package
// to compile or bundle — the runtime that Claude Desktop already ships
// includes it.

export interface OpenDatabaseResult {
  db: DatabaseSync;
  appliedMigrations: number[];
}

/**
 * Open (creating if needed) and migrate a database. Pass ":memory:" for an
 * in-memory database in tests.
 */
export function openDatabase(filePath: string): OpenDatabaseResult {
  const isMemory = filePath === ":memory:";
  if (!isMemory) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  let db: DatabaseSync;
  try {
    db = new DatabaseSync(filePath);
  } catch {
    throw new DomainError(
      "STORAGE_FAILURE",
      `The local database could not be opened at ${filePath}.`,
      "Check that the application-data directory is writable and not locked by another process.",
    );
  }

  db.exec("PRAGMA foreign_keys = ON");
  if (!isMemory) {
    db.exec("PRAGMA journal_mode = WAL");
  }

  const appliedMigrations = runMigrations(db);
  return { db, appliedMigrations };
}

/**
 * Write a consistent snapshot of the open database to `backupPath` using
 * `VACUUM INTO` (works while the database is in use; produces a compact copy).
 */
export function backupDatabase(db: DatabaseSync, backupPath: string): void {
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  if (fs.existsSync(backupPath)) {
    throw new DomainError(
      "STORAGE_FAILURE",
      `A backup already exists at ${backupPath}.`,
      "Choose a new backup file name; existing backups are never overwritten.",
    );
  }
  db.prepare("VACUUM INTO ?").run(backupPath);
}

/** Run `fn` inside a transaction, rolling back on any error. */
export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
