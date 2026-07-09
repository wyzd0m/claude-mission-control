import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// MSIX virtualization awareness (D-032). Claude Desktop ships as a packaged
// Windows app, so the extension's writes to %APPDATA%\ClaudeMissionControl
// are silently redirected into the package's LocalCache. An unpackaged
// process (the monitor, launched from a shortcut or terminal) resolving the
// same %APPDATA% path therefore sees a DIFFERENT, empty database. When the
// default database has no projects, the monitor looks for a populated
// virtualized copy and reads that instead — read-only semantics unchanged.

/** True when a SQLite database exists at `dbPath` and holds any project. */
export function databaseHasContent(dbPath: string): boolean {
  if (!fs.existsSync(dbPath)) return false;
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const row = db.prepare("SELECT COUNT(*) AS c FROM projects").get() as { c: number };
      return row.c > 0;
    } finally {
      db.close();
    }
  } catch {
    // Missing table, locked file, or not a database: treat as no content.
    return false;
  }
}

/**
 * Search MSIX package LocalCache directories for a populated Mission
 * Control database. Returns the most recently written candidate, or null.
 * `packagesRoot` is overridable for tests; defaults to the real
 * %LOCALAPPDATA%\Packages.
 */
export function findVirtualizedDatabase(packagesRoot?: string): string | null {
  if (packagesRoot === undefined) {
    if (process.platform !== "win32") return null;
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData === undefined || localAppData === "") return null;
    packagesRoot = path.join(localAppData, "Packages");
  }

  let packageNames: string[];
  try {
    packageNames = fs.readdirSync(packagesRoot);
  } catch {
    return null;
  }

  const candidates = packageNames
    .filter((name) => name.startsWith("Claude"))
    .map((name) =>
      path.join(
        packagesRoot,
        name,
        "LocalCache",
        "Roaming",
        "ClaudeMissionControl",
        "data",
        "mission-control.db",
      ),
    )
    .filter((dbPath) => databaseHasContent(dbPath));

  if (candidates.length === 0) return null;
  // Most recently written wins (WAL activity counts as writing).
  const mtime = (dbPath: string): number => {
    let latest = 0;
    for (const suffix of ["", "-wal"]) {
      try {
        latest = Math.max(latest, fs.statSync(dbPath + suffix).mtimeMs);
      } catch {
        // Missing WAL is fine.
      }
    }
    return latest;
  };
  return candidates.sort((a, b) => mtime(b) - mtime(a))[0]!;
}

/**
 * The database the monitor should read: an explicit CMC_DATA_DIR always
 * wins; otherwise the default path, unless it is empty and a populated
 * MSIX-virtualized database exists.
 */
export function resolveMonitorDatabase(defaultPath: string): {
  dbPath: string;
  virtualized: boolean;
} {
  if (process.env.CMC_DATA_DIR !== undefined && process.env.CMC_DATA_DIR !== "") {
    return { dbPath: defaultPath, virtualized: false };
  }
  if (databaseHasContent(defaultPath)) {
    return { dbPath: defaultPath, virtualized: false };
  }
  const virtualized = findVirtualizedDatabase();
  if (virtualized !== null) {
    return { dbPath: virtualized, virtualized: true };
  }
  return { dbPath: defaultPath, virtualized: false };
}
