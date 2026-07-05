import os from "node:os";
import path from "node:path";

/**
 * Resolve the OS-appropriate application-data directory for the PoC.
 * Never hard-codes a username. `CMC_POC_DATA_DIR` overrides the location so
 * automated tests can use an isolated temporary directory.
 */
export function resolveDataDir(): string {
  const override = process.env.CMC_POC_DATA_DIR;
  if (override && override.trim().length > 0) {
    return path.resolve(override);
  }

  const home = os.homedir();
  switch (process.platform) {
    case "win32": {
      const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
      return path.join(appData, "ClaudeMissionControl", "poc");
    }
    case "darwin":
      return path.join(home, "Library", "Application Support", "ClaudeMissionControl", "poc");
    default: {
      const xdg = process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share");
      return path.join(xdg, "ClaudeMissionControl", "poc");
    }
  }
}

export function stateFilePath(): string {
  return path.join(resolveDataDir(), "poc-state.json");
}
