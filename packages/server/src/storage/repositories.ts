import type { DatabaseSync } from "node:sqlite";
import {
  DomainError,
  projectSchema,
  taskSchema,
  decisionSchema,
  artifactSchema,
  checkpointSchema,
  activityEventSchema,
  TERMINAL_EVENT_STATUSES,
  type ActivityEvent,
  type ActivityEventRepository,
  type Artifact,
  type ArtifactRepository,
  type Checkpoint,
  type CheckpointRepository,
  type Decision,
  type DecisionRepository,
  type Project,
  type ProjectRepository,
  type ProjectStatus,
  type ProjectSummary,
  type SettingsRepository,
  type Task,
  type TaskFilter,
  type TaskRepository,
} from "@mission-control/domain";
import type { ZodType } from "zod";

type Row = Record<string, unknown>;

function parseJsonColumn(value: unknown, table: string, column: string): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    throw new DomainError(
      "STORAGE_CORRUPT",
      `A stored value in ${table}.${column} is not valid JSON.`,
      "Restore the most recent backup or export and re-import the project.",
    );
  }
}

function validateRow<T>(schema: ZodType<T>, candidate: unknown, table: string): T {
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new DomainError(
      "STORAGE_CORRUPT",
      `A stored ${table} record is invalid${issue ? ` (${issue.path.join(".")}: ${issue.message})` : ""}.`,
      "Restore the most recent backup or export and re-import the project.",
    );
  }
  return parsed.data;
}

function notFound(code: DomainError["code"], what: string): DomainError {
  return new DomainError(
    code,
    `${what} was not found.`,
    "It may have been deleted; refresh and try again.",
  );
}

function revisionConflict(what: string): DomainError {
  return new DomainError(
    "REVISION_CONFLICT",
    `${what} was modified by another operation.`,
    "Reload the record and re-apply the change on the latest revision.",
  );
}

// ---------------------------------------------------------------------------
// Projects

function projectFromRow(row: Row): Project {
  return validateRow(
    projectSchema,
    {
      id: row.id,
      name: row.name,
      description: row.description,
      goal: row.goal,
      definitionOfDone: row.definition_of_done,
      currentStage: row.current_stage,
      status: row.status,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    "projects",
  );
}

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(project: Project): void {
    this.db
      .prepare(
        `INSERT INTO projects (id, name, description, goal, definition_of_done, current_stage, status, revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        project.id,
        project.name,
        project.description,
        project.goal,
        project.definitionOfDone,
        project.currentStage,
        project.status,
        project.revision,
        project.createdAt,
        project.updatedAt,
      );
  }

  update(project: Project): void {
    const result = this.db
      .prepare(
        `UPDATE projects SET name = ?, description = ?, goal = ?, definition_of_done = ?, current_stage = ?, status = ?, revision = ?, updated_at = ?
         WHERE id = ? AND revision = ?`,
      )
      .run(
        project.name,
        project.description,
        project.goal,
        project.definitionOfDone,
        project.currentStage,
        project.status,
        project.revision,
        project.updatedAt,
        project.id,
        project.revision - 1,
      );
    if (result.changes === 0) {
      if (this.getById(project.id) === null) {
        throw notFound("PROJECT_NOT_FOUND", "The project");
      }
      throw revisionConflict("The project");
    }
  }

  getById(id: string): Project | null {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Row | undefined;
    return row ? projectFromRow(row) : null;
  }

  list(status?: ProjectStatus): ProjectSummary[] {
    const rows = (status
      ? this.db
          .prepare("SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC")
          .all(status)
      : this.db
          .prepare("SELECT * FROM projects ORDER BY updated_at DESC")
          .all()) as unknown as Row[];
    return rows.map((row) => {
      const project = projectFromRow(row);
      return {
        id: project.id,
        name: project.name,
        currentStage: project.currentStage,
        status: project.status,
        updatedAt: project.updatedAt,
      };
    });
  }

  delete(id: string): void {
    const result = this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    if (result.changes === 0) {
      throw notFound("PROJECT_NOT_FOUND", "The project");
    }
  }
}

// ---------------------------------------------------------------------------
// Tasks

function taskFromRow(row: Row): Task {
  return validateRow(
    taskSchema,
    {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      stage: row.stage,
      blockedReason: row.blocked_reason,
      parentTaskId: row.parent_task_id,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    },
    "tasks",
  );
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(task: Task): void {
    this.db
      .prepare(
        `INSERT INTO tasks (id, project_id, title, description, status, priority, stage, blocked_reason, parent_task_id, revision, created_at, updated_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.id,
        task.projectId,
        task.title,
        task.description,
        task.status,
        task.priority,
        task.stage,
        task.blockedReason,
        task.parentTaskId,
        task.revision,
        task.createdAt,
        task.updatedAt,
        task.completedAt,
      );
  }

  update(task: Task): void {
    const result = this.db
      .prepare(
        `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, stage = ?, blocked_reason = ?, parent_task_id = ?, revision = ?, updated_at = ?, completed_at = ?
         WHERE id = ? AND revision = ?`,
      )
      .run(
        task.title,
        task.description,
        task.status,
        task.priority,
        task.stage,
        task.blockedReason,
        task.parentTaskId,
        task.revision,
        task.updatedAt,
        task.completedAt,
        task.id,
        task.revision - 1,
      );
    if (result.changes === 0) {
      if (this.getById(task.id) === null) {
        throw notFound("TASK_NOT_FOUND", "The task");
      }
      throw revisionConflict("The task");
    }
  }

  getById(id: string): Task | null {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Row | undefined;
    return row ? taskFromRow(row) : null;
  }

  listByProject(projectId: string, filter?: TaskFilter): Task[] {
    const clauses = ["project_id = ?"];
    const params: unknown[] = [projectId];
    if (filter?.status !== undefined) {
      clauses.push("status = ?");
      params.push(filter.status);
    }
    if (filter?.stage !== undefined) {
      clauses.push("stage = ?");
      params.push(filter.stage);
    }
    if (filter?.parentTaskId !== undefined) {
      if (filter.parentTaskId === null) {
        clauses.push("parent_task_id IS NULL");
      } else {
        clauses.push("parent_task_id = ?");
        params.push(filter.parentTaskId);
      }
    }
    const rows = this.db
      .prepare(`SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY created_at ASC`)
      .all(...(params as never[])) as unknown as Row[];
    return rows.map(taskFromRow);
  }

  delete(id: string): void {
    const result = this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    if (result.changes === 0) {
      throw notFound("TASK_NOT_FOUND", "The task");
    }
  }
}

// ---------------------------------------------------------------------------
// Decisions

function decisionFromRow(row: Row): Decision {
  return validateRow(
    decisionSchema,
    {
      id: row.id,
      projectId: row.project_id,
      summary: row.summary,
      rationale: row.rationale,
      alternativesConsidered: parseJsonColumn(
        row.alternatives_considered,
        "decisions",
        "alternatives_considered",
      ),
      relatedTaskIds: parseJsonColumn(row.related_task_ids, "decisions", "related_task_ids"),
      createdAt: row.created_at,
    },
    "decisions",
  );
}

export class SqliteDecisionRepository implements DecisionRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(decision: Decision): void {
    this.db
      .prepare(
        `INSERT INTO decisions (id, project_id, summary, rationale, alternatives_considered, related_task_ids, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        decision.id,
        decision.projectId,
        decision.summary,
        decision.rationale,
        JSON.stringify(decision.alternativesConsidered),
        JSON.stringify(decision.relatedTaskIds),
        decision.createdAt,
      );
  }

  getById(id: string): Decision | null {
    const row = this.db.prepare("SELECT * FROM decisions WHERE id = ?").get(id) as Row | undefined;
    return row ? decisionFromRow(row) : null;
  }

  listByProject(projectId: string): Decision[] {
    const rows = this.db
      .prepare("SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as unknown as Row[];
    return rows.map(decisionFromRow);
  }
}

// ---------------------------------------------------------------------------
// Artifacts

function artifactFromRow(row: Row): Artifact {
  return validateRow(
    artifactSchema,
    {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      type: row.type,
      pathOrReference: row.path_or_reference,
      description: row.description,
      relatedTaskIds: parseJsonColumn(row.related_task_ids, "artifacts", "related_task_ids"),
      verificationStatus: row.verification_status,
      verificationNote: row.verification_note,
      verifiedAt: row.verified_at,
      createdAt: row.created_at,
    },
    "artifacts",
  );
}

export class SqliteArtifactRepository implements ArtifactRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(artifact: Artifact): void {
    this.db
      .prepare(
        `INSERT INTO artifacts (id, project_id, name, type, path_or_reference, description, related_task_ids, verification_status, verification_note, verified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        artifact.id,
        artifact.projectId,
        artifact.name,
        artifact.type,
        artifact.pathOrReference,
        artifact.description,
        JSON.stringify(artifact.relatedTaskIds),
        artifact.verificationStatus,
        artifact.verificationNote,
        artifact.verifiedAt,
        artifact.createdAt,
      );
  }

  update(artifact: Artifact): void {
    const result = this.db
      .prepare(
        `UPDATE artifacts SET name = ?, type = ?, path_or_reference = ?, description = ?, related_task_ids = ?, verification_status = ?, verification_note = ?, verified_at = ?
         WHERE id = ?`,
      )
      .run(
        artifact.name,
        artifact.type,
        artifact.pathOrReference,
        artifact.description,
        JSON.stringify(artifact.relatedTaskIds),
        artifact.verificationStatus,
        artifact.verificationNote,
        artifact.verifiedAt,
        artifact.id,
      );
    if (result.changes === 0) {
      throw notFound("ARTIFACT_NOT_FOUND", "The artifact");
    }
  }

  getById(id: string): Artifact | null {
    const row = this.db.prepare("SELECT * FROM artifacts WHERE id = ?").get(id) as Row | undefined;
    return row ? artifactFromRow(row) : null;
  }

  listByProject(projectId: string): Artifact[] {
    const rows = this.db
      .prepare("SELECT * FROM artifacts WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as unknown as Row[];
    return rows.map(artifactFromRow);
  }
}

// ---------------------------------------------------------------------------
// Checkpoints

function checkpointFromRow(row: Row): Checkpoint {
  return validateRow(
    checkpointSchema,
    {
      id: row.id,
      projectId: row.project_id,
      summary: row.summary,
      completedWork: parseJsonColumn(row.completed_work, "checkpoints", "completed_work"),
      openWork: parseJsonColumn(row.open_work, "checkpoints", "open_work"),
      decisions: parseJsonColumn(row.decisions, "checkpoints", "decisions"),
      blockers: parseJsonColumn(row.blockers, "checkpoints", "blockers"),
      recommendedNextAction: row.recommended_next_action,
      createdAt: row.created_at,
    },
    "checkpoints",
  );
}

export class SqliteCheckpointRepository implements CheckpointRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(checkpoint: Checkpoint): void {
    this.db
      .prepare(
        `INSERT INTO checkpoints (id, project_id, summary, completed_work, open_work, decisions, blockers, recommended_next_action, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        checkpoint.id,
        checkpoint.projectId,
        checkpoint.summary,
        JSON.stringify(checkpoint.completedWork),
        JSON.stringify(checkpoint.openWork),
        JSON.stringify(checkpoint.decisions),
        JSON.stringify(checkpoint.blockers),
        checkpoint.recommendedNextAction,
        checkpoint.createdAt,
      );
  }

  getById(id: string): Checkpoint | null {
    const row = this.db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(id) as
      Row | undefined;
    return row ? checkpointFromRow(row) : null;
  }

  getLatestByProject(projectId: string): Checkpoint | null {
    const row = this.db
      .prepare(
        "SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
      )
      .get(projectId) as Row | undefined;
    return row ? checkpointFromRow(row) : null;
  }

  listByProject(projectId: string): Checkpoint[] {
    const rows = this.db
      .prepare("SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as unknown as Row[];
    return rows.map(checkpointFromRow);
  }
}

// ---------------------------------------------------------------------------
// Activity events

function eventFromRow(row: Row): ActivityEvent {
  return validateRow(
    activityEventSchema,
    {
      id: row.id,
      projectId: row.project_id,
      correlationId: row.correlation_id,
      toolName: row.tool_name,
      displayLabel: row.display_label,
      department: row.department,
      status: row.status,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      progressCurrent: row.progress_current,
      progressTotal: row.progress_total,
      progressMessage: row.progress_message,
      relatedTaskIds: parseJsonColumn(row.related_task_ids, "activity_events", "related_task_ids"),
      requiresInput: row.requires_input === 1,
      resultSummary: row.result_summary,
      errorCode: row.error_code,
      errorSummary: row.error_summary,
    },
    "activity_events",
  );
}

export class SqliteActivityEventRepository implements ActivityEventRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(event: ActivityEvent): void {
    this.db
      .prepare(
        `INSERT INTO activity_events (id, project_id, correlation_id, tool_name, display_label, department, status, started_at, updated_at, completed_at, progress_current, progress_total, progress_message, related_task_ids, requires_input, result_summary, error_code, error_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        event.projectId,
        event.correlationId,
        event.toolName,
        event.displayLabel,
        event.department,
        event.status,
        event.startedAt,
        event.updatedAt,
        event.completedAt,
        event.progressCurrent,
        event.progressTotal,
        event.progressMessage,
        JSON.stringify(event.relatedTaskIds),
        event.requiresInput ? 1 : 0,
        event.resultSummary,
        event.errorCode,
        event.errorSummary,
      );
  }

  update(event: ActivityEvent): void {
    const result = this.db
      .prepare(
        `UPDATE activity_events SET project_id = ?, status = ?, updated_at = ?, completed_at = ?, progress_current = ?, progress_total = ?, progress_message = ?, requires_input = ?, result_summary = ?, error_code = ?, error_summary = ?
         WHERE id = ?`,
      )
      .run(
        event.projectId,
        event.status,
        event.updatedAt,
        event.completedAt,
        event.progressCurrent,
        event.progressTotal,
        event.progressMessage,
        event.requiresInput ? 1 : 0,
        event.resultSummary,
        event.errorCode,
        event.errorSummary,
        event.id,
      );
    if (result.changes === 0) {
      throw notFound("EVENT_NOT_FOUND", "The activity event");
    }
  }

  getById(id: string): ActivityEvent | null {
    const row = this.db.prepare("SELECT * FROM activity_events WHERE id = ?").get(id) as
      Row | undefined;
    return row ? eventFromRow(row) : null;
  }

  listRecent(limit: number, projectId?: string): ActivityEvent[] {
    const rows = (projectId
      ? this.db
          .prepare(
            "SELECT * FROM activity_events WHERE project_id = ? ORDER BY started_at DESC, rowid DESC LIMIT ?",
          )
          .all(projectId, limit)
      : this.db
          .prepare("SELECT * FROM activity_events ORDER BY started_at DESC, rowid DESC LIMIT ?")
          .all(limit)) as unknown as Row[];
    return rows.map(eventFromRow);
  }

  listOpen(): ActivityEvent[] {
    const placeholders = TERMINAL_EVENT_STATUSES.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT * FROM activity_events WHERE status NOT IN (${placeholders}) ORDER BY started_at ASC, rowid ASC`,
      )
      .all(...(TERMINAL_EVENT_STATUSES as unknown as never[])) as unknown as Row[];
    return rows.map(eventFromRow);
  }
}

// ---------------------------------------------------------------------------
// Settings

export class SqliteSettingsRepository implements SettingsRepository {
  constructor(private readonly db: DatabaseSync) {}

  get(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
      Row | undefined;
    return row ? String(row.value) : null;
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(key, value);
  }

  delete(key: string): void {
    this.db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  }
}
