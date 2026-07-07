import type { ActivityEvent } from "./activity-event.js";
import type { Checkpoint } from "./checkpoint.js";
import type { Decision } from "./decision.js";
import type { Project } from "./project.js";
import type { ProjectSummary } from "./repositories.js";
import type { Task } from "./task.js";

// Read models for the dashboard (docs/SYSTEM_ARCHITECTURE.md "UI state
// projection"). The server builds them; the UI renders them read-only and
// never infers business state from anything else. Defined in the domain so
// the UI needs no dependency on server internals.

export interface CurrentActivity {
  openEvents: ActivityEvent[];
  idle: boolean;
  idleMessage: string | null;
}

export interface DashboardState {
  generatedAt: string;
  serverVersion: string;
  projects: ProjectSummary[];
  activeProjectId: string | null;
  activeProject: Project | null;
  /** Explicit project progress from saved task data only. */
  projectProgress: { doneTasks: number; totalTasks: number } | null;
  tasks: Task[];
  decisions: Decision[];
  latestCheckpoint: Checkpoint | null;
  currentActivity: CurrentActivity;
  timeline: ActivityEvent[];
}
