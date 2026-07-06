import type { DatabaseSync } from "node:sqlite";
import {
  DomainError,
  EXPORT_FORMAT_VERSION,
  validateProjectExport,
  type ProjectExport,
} from "@mission-control/domain";
import { withTransaction } from "./database.js";
import {
  SqliteArtifactRepository,
  SqliteCheckpointRepository,
  SqliteDecisionRepository,
  SqliteProjectRepository,
  SqliteTaskRepository,
} from "./repositories.js";

/**
 * Build a portable export bundle for one project
 * (docs/TOOL_AND_EVENT_MODEL.md `export_project`). Activity events are
 * intentionally excluded — they are operational telemetry, not project state.
 */
export function buildProjectExport(
  db: DatabaseSync,
  projectId: string,
  now: () => Date = () => new Date(),
): ProjectExport {
  const projects = new SqliteProjectRepository(db);
  const project = projects.getById(projectId);
  if (project === null) {
    throw new DomainError(
      "PROJECT_NOT_FOUND",
      "The selected project no longer exists.",
      "Choose another project or create a new one.",
    );
  }
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: now().toISOString(),
    project,
    tasks: new SqliteTaskRepository(db).listByProject(projectId),
    decisions: new SqliteDecisionRepository(db).listByProject(projectId),
    artifacts: new SqliteArtifactRepository(db).listByProject(projectId),
    checkpoints: new SqliteCheckpointRepository(db).listByProject(projectId),
  };
}

/**
 * Validate and import a project bundle inside one transaction
 * (docs/PRODUCT_REQUIREMENTS.md §8: imported data is validated before any
 * write). Fails with IMPORT_CONFLICT if the project already exists — the
 * preview/approve flow in Phase 3 decides how conflicts are resolved.
 */
export function importProject(db: DatabaseSync, payload: unknown): ProjectExport {
  const bundle = validateProjectExport(payload);

  const projects = new SqliteProjectRepository(db);
  if (projects.getById(bundle.project.id) !== null) {
    throw new DomainError(
      "IMPORT_CONFLICT",
      `A project with id ${bundle.project.id} already exists.`,
      "Delete or archive the existing project first, or import into a different data directory.",
    );
  }

  withTransaction(db, () => {
    projects.insert(bundle.project);
    const tasks = new SqliteTaskRepository(db);
    // Parents must exist before children (FK on parent_task_id).
    const pending = [...bundle.tasks];
    const inserted = new Set<string>();
    while (pending.length > 0) {
      const before = pending.length;
      for (let i = pending.length - 1; i >= 0; i--) {
        const task = pending[i]!;
        if (task.parentTaskId === null || inserted.has(task.parentTaskId)) {
          tasks.insert(task);
          inserted.add(task.id);
          pending.splice(i, 1);
        }
      }
      if (pending.length === before) {
        throw new DomainError(
          "IMPORT_INVALID",
          "The export contains a cycle in parent-task references.",
          "Export the project again from Mission Control and import that file unmodified.",
        );
      }
    }
    const decisions = new SqliteDecisionRepository(db);
    for (const decision of bundle.decisions) decisions.insert(decision);
    const artifacts = new SqliteArtifactRepository(db);
    for (const artifact of bundle.artifacts) artifacts.insert(artifact);
    const checkpoints = new SqliteCheckpointRepository(db);
    for (const checkpoint of bundle.checkpoints) checkpoints.insert(checkpoint);
  });

  return bundle;
}
