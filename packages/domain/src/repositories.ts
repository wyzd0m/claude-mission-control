import type { Project, ProjectStatus } from "./project.js";
import type { Task, TaskStatus } from "./task.js";
import type { Decision } from "./decision.js";
import type { Artifact } from "./artifact.js";
import type { Checkpoint } from "./checkpoint.js";
import type { ActivityEvent } from "./activity-event.js";

// Storage contracts (docs/SYSTEM_ARCHITECTURE.md "Storage adapter"): domain
// and application code depend on these interfaces, never on SQL. The SQLite
// implementations live in @mission-control/server.
//
// Updates use optimistic concurrency: the caller passes the entity with its
// already-bumped revision, and the store must only overwrite the row whose
// stored revision equals `revision - 1`, throwing REVISION_CONFLICT otherwise.

export interface ProjectSummary {
  id: string;
  name: string;
  currentStage: Project["currentStage"];
  status: ProjectStatus;
  updatedAt: string;
}

export interface ProjectRepository {
  insert(project: Project): void;
  update(project: Project): void;
  getById(id: string): Project | null;
  list(status?: ProjectStatus): ProjectSummary[];
  /** Permanently removes the project and all owned records. */
  delete(id: string): void;
}

export interface TaskFilter {
  status?: TaskStatus;
  stage?: Task["stage"];
  parentTaskId?: string | null;
}

export interface TaskRepository {
  insert(task: Task): void;
  update(task: Task): void;
  getById(id: string): Task | null;
  listByProject(projectId: string, filter?: TaskFilter): Task[];
  delete(id: string): void;
}

export interface DecisionRepository {
  insert(decision: Decision): void;
  getById(id: string): Decision | null;
  listByProject(projectId: string): Decision[];
}

export interface ArtifactRepository {
  insert(artifact: Artifact): void;
  update(artifact: Artifact): void;
  getById(id: string): Artifact | null;
  listByProject(projectId: string): Artifact[];
}

export interface CheckpointRepository {
  insert(checkpoint: Checkpoint): void;
  getById(id: string): Checkpoint | null;
  getLatestByProject(projectId: string): Checkpoint | null;
  listByProject(projectId: string): Checkpoint[];
}

export interface ActivityEventRepository {
  insert(event: ActivityEvent): void;
  update(event: ActivityEvent): void;
  getById(id: string): ActivityEvent | null;
  /** Newest first. */
  listRecent(limit: number, projectId?: string): ActivityEvent[];
  /** Events not yet in a terminal status, oldest first. */
  listOpen(): ActivityEvent[];
}

export interface SettingsRepository {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

/** Well-known settings keys. */
export const SETTING_ACTIVE_PROJECT_ID = "active_project_id";
