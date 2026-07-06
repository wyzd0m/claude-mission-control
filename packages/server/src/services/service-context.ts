import type { DatabaseSync } from "node:sqlite";
import { DomainError, SETTING_ACTIVE_PROJECT_ID, type Project } from "@mission-control/domain";
import {
  SqliteActivityEventRepository,
  SqliteArtifactRepository,
  SqliteCheckpointRepository,
  SqliteDecisionRepository,
  SqliteProjectRepository,
  SqliteSettingsRepository,
  SqliteTaskRepository,
} from "../storage/repositories.js";
import { ApprovalService } from "./approval-service.js";

/** Shared wiring for all application services and the MCP adapter. */
export interface ServiceContext {
  db: DatabaseSync;
  projects: SqliteProjectRepository;
  tasks: SqliteTaskRepository;
  decisions: SqliteDecisionRepository;
  artifacts: SqliteArtifactRepository;
  checkpoints: SqliteCheckpointRepository;
  events: SqliteActivityEventRepository;
  settings: SqliteSettingsRepository;
  approvals: ApprovalService;
  now: () => Date;
}

export function createServiceContext(
  db: DatabaseSync,
  options?: { now?: () => Date; approvalTtlMs?: number },
): ServiceContext {
  const now = options?.now ?? (() => new Date());
  return {
    db,
    projects: new SqliteProjectRepository(db),
    tasks: new SqliteTaskRepository(db),
    decisions: new SqliteDecisionRepository(db),
    artifacts: new SqliteArtifactRepository(db),
    checkpoints: new SqliteCheckpointRepository(db),
    events: new SqliteActivityEventRepository(db),
    settings: new SqliteSettingsRepository(db),
    approvals: new ApprovalService(now, options?.approvalTtlMs),
    now,
  };
}

/**
 * Resolve a project by explicit id or fall back to the active project.
 * Central helper because most tools accept an optional projectId.
 */
export function requireProject(ctx: ServiceContext, projectId?: string): Project {
  const id = projectId ?? ctx.settings.get(SETTING_ACTIVE_PROJECT_ID);
  if (id === null || id === undefined) {
    throw new DomainError(
      "PROJECT_NOT_FOUND",
      "No project was specified and no active project is set.",
      "Pass projectId, or set one with set_active_project.",
    );
  }
  const project = ctx.projects.getById(id);
  if (project === null) {
    throw new DomainError(
      "PROJECT_NOT_FOUND",
      "The selected project no longer exists.",
      "Choose another project with list_projects, or create one with create_project.",
    );
  }
  return project;
}
