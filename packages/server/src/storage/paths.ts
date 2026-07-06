import os from "node:os";
import path from "node:path";

/**
 * OS-appropriate application-data directories (docs/TECHNOLOGY_PLAN.md "Data
 * directories"). Never hard-codes a username. `CMC_DATA_DIR` overrides the
 * root so tests can use isolated temporary directories.
 */
export function resolveDataRoot(): string {
  const override = process.env.CMC_DATA_DIR;
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }

  const home = os.homedir();
  switch (process.platform) {
    case "win32": {
      const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
      return path.join(appData, "ClaudeMissionControl");
    }
    case "darwin":
      return path.join(home, "Library", "Application Support", "ClaudeMissionControl");
    default: {
      const xdg = process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share");
      return path.join(xdg, "ClaudeMissionControl");
    }
  }
}

export function databaseFilePath(): string {
  return path.join(resolveDataRoot(), "data", "mission-control.db");
}

export function backupsDirPath(): string {
  return path.join(resolveDataRoot(), "backups");
}

export function exportsDirPath(): string {
  return path.join(resolveDataRoot(), "exports");
}

export function logsDirPath(): string {
  return path.join(resolveDataRoot(), "logs");
}
