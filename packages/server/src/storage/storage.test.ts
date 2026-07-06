import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createArtifact,
  createActivityEvent,
  createCheckpoint,
  createDecision,
  createProject,
  createTask,
  type DomainError,
  setArtifactVerification,
  transitionEvent,
  updateTask,
  updateProjectDetails,
  SETTING_ACTIVE_PROJECT_ID,
} from "@mission-control/domain";
import { backupDatabase, openDatabase } from "./database.js";
import { MIGRATIONS, runMigrations } from "./migrations.js";
import {
  SqliteActivityEventRepository,
  SqliteArtifactRepository,
  SqliteCheckpointRepository,
  SqliteDecisionRepository,
  SqliteProjectRepository,
  SqliteSettingsRepository,
  SqliteTaskRepository,
} from "./repositories.js";
import { buildProjectExport, importProject } from "./import-export.js";

type Db = ReturnType<typeof openDatabase>["db"];

let db: Db;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(":memory:").db;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmc-storage-test-"));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function seedProject(name = "Demo") {
  const project = createProject({ name });
  new SqliteProjectRepository(db).insert(project);
  return project;
}

describe("migrations", () => {
  it("creates the full schema on an empty database", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    for (const expected of [
      "projects",
      "tasks",
      "decisions",
      "artifacts",
      "checkpoints",
      "activity_events",
      "settings",
      "migrations",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("is idempotent and records applied migrations", () => {
    expect(runMigrations(db)).toEqual([]);
    const rows = db.prepare("SELECT id FROM migrations ORDER BY id").all() as { id: number }[];
    expect(rows.map((r) => r.id)).toEqual(MIGRATIONS.map((m) => m.id));
  });
});

describe("project repository", () => {
  it("round-trips a project through insert and getById", () => {
    const project = seedProject();
    expect(new SqliteProjectRepository(db).getById(project.id)).toEqual(project);
  });

  it("updates with optimistic concurrency", () => {
    const repo = new SqliteProjectRepository(db);
    const project = seedProject();
    const updated = updateProjectDetails(project, { goal: "Ship v1" });
    repo.update(updated);
    expect(repo.getById(project.id)?.goal).toBe("Ship v1");

    // Re-applying the same stale revision must conflict.
    try {
      repo.update(updated);
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe("REVISION_CONFLICT");
    }
  });

  it("reports missing projects distinctly from conflicts", () => {
    const repo = new SqliteProjectRepository(db);
    const ghost = updateProjectDetails(createProject({ name: "Ghost" }), {});
    try {
      repo.update(ghost);
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe("PROJECT_NOT_FOUND");
    }
  });

  it("lists summaries filtered by status", () => {
    seedProject("One");
    seedProject("Two");
    const repo = new SqliteProjectRepository(db);
    expect(repo.list()).toHaveLength(2);
    expect(repo.list("archived")).toHaveLength(0);
  });

  it("deleting a project cascades to owned records", () => {
    const project = seedProject();
    const task = createTask({ projectId: project.id, title: "T" });
    new SqliteTaskRepository(db).insert(task);
    new SqliteDecisionRepository(db).insert(
      createDecision({ projectId: project.id, summary: "D", rationale: "r" }),
    );
    new SqliteProjectRepository(db).delete(project.id);
    expect(new SqliteTaskRepository(db).getById(task.id)).toBeNull();
    expect(new SqliteDecisionRepository(db).listByProject(project.id)).toHaveLength(0);
  });
});

describe("task repository", () => {
  it("supports CRUD, filters, and revision conflicts", () => {
    const project = seedProject();
    const repo = new SqliteTaskRepository(db);
    const a = createTask({ projectId: project.id, title: "A", stage: "building" });
    const b = createTask({ projectId: project.id, title: "B" });
    repo.insert(a);
    repo.insert(b);

    const done = updateTask(a, { status: "done" });
    repo.update(done);
    expect(repo.getById(a.id)?.completedAt).not.toBeNull();

    expect(repo.listByProject(project.id)).toHaveLength(2);
    expect(repo.listByProject(project.id, { status: "done" }).map((t) => t.id)).toEqual([a.id]);
    expect(repo.listByProject(project.id, { stage: "building" }).map((t) => t.id)).toEqual([a.id]);

    try {
      repo.update(done);
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe("REVISION_CONFLICT");
    }

    repo.delete(b.id);
    expect(repo.getById(b.id)).toBeNull();
  });

  it("rejects tasks for a missing project (foreign keys on)", () => {
    const repo = new SqliteTaskRepository(db);
    expect(() => repo.insert(createTask({ projectId: "nope", title: "T" }))).toThrow();
  });
});

describe("decision, artifact, and checkpoint repositories", () => {
  it("round-trips decisions with JSON columns", () => {
    const project = seedProject();
    const repo = new SqliteDecisionRepository(db);
    const decision = createDecision({
      projectId: project.id,
      summary: "Use node:sqlite",
      rationale: "No native deps",
      alternativesConsidered: ["better-sqlite3"],
    });
    repo.insert(decision);
    expect(repo.getById(decision.id)).toEqual(decision);
  });

  it("round-trips artifact verification updates", () => {
    const project = seedProject();
    const repo = new SqliteArtifactRepository(db);
    const artifact = createArtifact({
      projectId: project.id,
      name: "login.ts",
      pathOrReference: "src/login.ts",
    });
    repo.insert(artifact);
    const verified = setArtifactVerification(artifact, "verified", "Unit tests passed");
    repo.update(verified);
    expect(repo.getById(artifact.id)?.verificationStatus).toBe("verified");
  });

  it("returns the latest checkpoint", () => {
    const project = seedProject();
    const repo = new SqliteCheckpointRepository(db);
    repo.insert(
      createCheckpoint(
        { projectId: project.id, summary: "old" },
        { now: () => new Date("2026-07-01T00:00:00.000Z") },
      ),
    );
    const latest = createCheckpoint(
      { projectId: project.id, summary: "new" },
      { now: () => new Date("2026-07-05T00:00:00.000Z") },
    );
    repo.insert(latest);
    expect(repo.getLatestByProject(project.id)?.id).toBe(latest.id);
  });
});

describe("activity event repository", () => {
  it("persists the full lifecycle and lists open and recent events", () => {
    const project = seedProject();
    const repo = new SqliteActivityEventRepository(db);
    let event = createActivityEvent({
      projectId: project.id,
      toolName: "create_task",
      displayLabel: "Creating task",
      department: "planning_bay",
    });
    repo.insert(event);
    expect(repo.listOpen()).toHaveLength(1);

    event = transitionEvent(event, "working");
    event = transitionEvent(event, "succeeded", { resultSummary: "Created" });
    repo.update(event);

    expect(repo.listOpen()).toHaveLength(0);
    const recent = repo.listRecent(10, project.id);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toEqual(event);
  });
});

describe("settings repository", () => {
  it("sets, overwrites, reads, and deletes keys", () => {
    const repo = new SqliteSettingsRepository(db);
    expect(repo.get(SETTING_ACTIVE_PROJECT_ID)).toBeNull();
    repo.set(SETTING_ACTIVE_PROJECT_ID, "p1");
    repo.set(SETTING_ACTIVE_PROJECT_ID, "p2");
    expect(repo.get(SETTING_ACTIVE_PROJECT_ID)).toBe("p2");
    repo.delete(SETTING_ACTIVE_PROJECT_ID);
    expect(repo.get(SETTING_ACTIVE_PROJECT_ID)).toBeNull();
  });
});

describe("export and import", () => {
  function seedFullProject() {
    const project = seedProject("Exportable");
    const tasks = new SqliteTaskRepository(db);
    const parent = createTask({ projectId: project.id, title: "Parent" });
    tasks.insert(parent);
    const child = createTask({ projectId: project.id, title: "Child", parentTaskId: parent.id });
    tasks.insert(child);
    new SqliteDecisionRepository(db).insert(
      createDecision({
        projectId: project.id,
        summary: "D",
        rationale: "r",
        relatedTaskIds: [parent.id],
      }),
    );
    new SqliteArtifactRepository(db).insert(
      createArtifact({ projectId: project.id, name: "a", pathOrReference: "a.ts" }),
    );
    new SqliteCheckpointRepository(db).insert(
      createCheckpoint({ projectId: project.id, summary: "cp" }),
    );
    return project;
  }

  it("round-trips a full project into a fresh database", () => {
    const project = seedFullProject();
    const bundle = buildProjectExport(db, project.id, () => new Date("2026-07-05T12:00:00.000Z"));

    const fresh = openDatabase(":memory:").db;
    importProject(fresh, JSON.parse(JSON.stringify(bundle)));
    const reExported = buildProjectExport(
      fresh,
      project.id,
      () => new Date("2026-07-05T12:00:00.000Z"),
    );
    expect(reExported).toEqual(bundle);
    fresh.close();
  });

  it("imports children after parents regardless of order", () => {
    const project = seedFullProject();
    const bundle = buildProjectExport(db, project.id);
    bundle.tasks.reverse();

    const fresh = openDatabase(":memory:").db;
    importProject(fresh, JSON.parse(JSON.stringify(bundle)));
    expect(new SqliteTaskRepository(fresh).listByProject(project.id)).toHaveLength(2);
    fresh.close();
  });

  it("rejects importing over an existing project", () => {
    const project = seedFullProject();
    const bundle = buildProjectExport(db, project.id);
    try {
      importProject(db, JSON.parse(JSON.stringify(bundle)));
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe("IMPORT_CONFLICT");
    }
  });

  it("rolls back everything when an import fails midway", () => {
    const project = seedFullProject();
    const bundle = buildProjectExport(db, project.id);
    const sabotage = JSON.parse(JSON.stringify(bundle)) as typeof bundle;
    // Two tasks with the same id -> primary-key violation inside the transaction.
    sabotage.tasks[1] = { ...sabotage.tasks[1]!, id: sabotage.tasks[0]!.id, parentTaskId: null };
    sabotage.decisions = [];
    sabotage.artifacts = [];

    const fresh = openDatabase(":memory:").db;
    expect(() => importProject(fresh, sabotage)).toThrow();
    expect(new SqliteProjectRepository(fresh).getById(project.id)).toBeNull();
    expect(new SqliteTaskRepository(fresh).listByProject(project.id)).toHaveLength(0);
    fresh.close();
  });

  it("exporting a missing project fails with PROJECT_NOT_FOUND", () => {
    try {
      buildProjectExport(db, "missing");
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe("PROJECT_NOT_FOUND");
    }
  });
});

describe("file persistence, corruption, and backup", () => {
  it("persists data across close and reopen", () => {
    const file = path.join(tmpDir, "data", "mission-control.db");
    const first = openDatabase(file);
    expect(first.appliedMigrations).toEqual(MIGRATIONS.map((m) => m.id));
    const project = createProject({ name: "Persistent" });
    new SqliteProjectRepository(first.db).insert(project);
    first.db.close();

    const second = openDatabase(file);
    expect(second.appliedMigrations).toEqual([]);
    expect(new SqliteProjectRepository(second.db).getById(project.id)).toEqual(project);
    second.db.close();
  });

  it("surfaces corrupted JSON columns as STORAGE_CORRUPT", () => {
    const project = seedProject();
    const decision = createDecision({ projectId: project.id, summary: "D", rationale: "r" });
    new SqliteDecisionRepository(db).insert(decision);
    db.prepare("UPDATE decisions SET related_task_ids = ? WHERE id = ?").run(
      "not-json",
      decision.id,
    );
    try {
      new SqliteDecisionRepository(db).getById(decision.id);
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe("STORAGE_CORRUPT");
    }
  });

  it("surfaces invalid stored values as STORAGE_CORRUPT", () => {
    const project = seedProject();
    db.prepare("UPDATE projects SET current_stage = ? WHERE id = ?").run("warp-speed", project.id);
    try {
      new SqliteProjectRepository(db).getById(project.id);
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe("STORAGE_CORRUPT");
    }
  });

  it("backs up a live database and never overwrites an existing backup", () => {
    const project = seedProject();
    const backupPath = path.join(tmpDir, "backups", "backup-1.db");
    backupDatabase(db, backupPath);

    const restored = openDatabase(backupPath);
    expect(new SqliteProjectRepository(restored.db).getById(project.id)?.name).toBe(project.name);
    restored.db.close();

    expect(() => backupDatabase(db, backupPath)).toThrow(/already exists/);
  });
});
