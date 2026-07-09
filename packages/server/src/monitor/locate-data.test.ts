// MSIX virtualization awareness tests (D-032): the monitor must find the
// packaged Claude Desktop's virtualized database when the literal %APPDATA%
// path is empty, and never override an explicit CMC_DATA_DIR.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../storage/database.js";
import { createServiceContext } from "../services/service-context.js";
import { createProjectService } from "../services/project-service.js";
import {
  databaseHasContent,
  findVirtualizedDatabase,
  resolveMonitorDatabase,
} from "./locate-data.js";

let tmpDir: string;

/** Create a real Mission Control database, optionally with a project. */
function makeDatabase(dir: string, withProject: boolean): string {
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, "mission-control.db");
  const { db } = openDatabase(dbPath);
  if (withProject) {
    createProjectService(createServiceContext(db)).create({ name: "Virtual", goal: "Find me" });
  }
  db.close();
  return dbPath;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmc-locate-test-"));
  process.env.CMC_DATA_DIR = tmpDir; // keep openDatabase side files inside tmp
});

afterEach(() => {
  delete process.env.CMC_DATA_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("databaseHasContent", () => {
  it("is false for missing files, empty databases, and true with a project", () => {
    expect(databaseHasContent(path.join(tmpDir, "nope.db"))).toBe(false);
    const empty = makeDatabase(path.join(tmpDir, "empty"), false);
    expect(databaseHasContent(empty)).toBe(false);
    const full = makeDatabase(path.join(tmpDir, "full"), true);
    expect(databaseHasContent(full)).toBe(true);
  });
});

describe("findVirtualizedDatabase", () => {
  it("finds a populated database under a Claude package LocalCache", () => {
    const packagesRoot = path.join(tmpDir, "Packages");
    const dataDir = path.join(
      packagesRoot,
      "Claude_pzs8sxrjxfjjc",
      "LocalCache",
      "Roaming",
      "ClaudeMissionControl",
      "data",
    );
    const dbPath = makeDatabase(dataDir, true);
    expect(findVirtualizedDatabase(packagesRoot)).toBe(dbPath);
  });

  it("ignores empty virtualized databases and unrelated packages", () => {
    const packagesRoot = path.join(tmpDir, "Packages");
    makeDatabase(
      path.join(
        packagesRoot,
        "Claude_abc",
        "LocalCache",
        "Roaming",
        "ClaudeMissionControl",
        "data",
      ),
      false,
    );
    makeDatabase(
      path.join(packagesRoot, "Other_abc", "LocalCache", "Roaming", "ClaudeMissionControl", "data"),
      true,
    );
    expect(findVirtualizedDatabase(packagesRoot)).toBeNull();
    expect(findVirtualizedDatabase(path.join(tmpDir, "missing-root"))).toBeNull();
  });
});

describe("resolveMonitorDatabase", () => {
  it("keeps the default path when it has content", () => {
    const full = makeDatabase(path.join(tmpDir, "default"), true);
    expect(resolveMonitorDatabase(full)).toEqual({ dbPath: full, virtualized: false });
  });

  it("never overrides an explicit CMC_DATA_DIR, even when empty", () => {
    const empty = makeDatabase(path.join(tmpDir, "explicit"), false);
    // CMC_DATA_DIR is set for the whole suite (beforeEach).
    expect(resolveMonitorDatabase(empty)).toEqual({ dbPath: empty, virtualized: false });
  });
});
