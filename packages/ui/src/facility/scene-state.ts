import {
  DEPARTMENTS,
  type DashboardState,
  type Department,
  type ProjectStage,
} from "@mission-control/domain";

// Deterministic scene state (docs/TESTING_STRATEGY.md "3D state tests"):
// a pure derivation from the DashboardState read model. The renderer draws
// exactly this; it never invents activity. Rooms react only to persisted
// events and the explicitly saved project stage.

export interface RoomSceneState {
  department: Department;
  label: string;
  /** The saved project stage strengthens the related room (VISUAL_DESIGN §9). */
  stageHighlight: boolean;
  /** Open queued/travelling/working events in this department. */
  workingCount: number;
  /** An approval is waiting here (Security Gate amber). */
  waiting: boolean;
  /** The most recent event of this department failed. */
  failed: boolean;
}

export interface SceneState {
  rooms: RoomSceneState[];
  /** Where the robot stands: the department of the oldest open event, else Command Core. */
  robotAt: Department;
  stage: ProjectStage | null;
  idle: boolean;
}

export const DEPARTMENT_LABELS: Record<Department, string> = {
  command_core: "Command Core",
  planning_bay: "Planning Bay",
  research_archive: "Research Archive",
  build_workshop: "Build Workshop",
  testing_lab: "Testing Lab",
  memory_vault: "Memory Vault",
  security_gate: "Security Gate",
  delivery_dock: "Delivery Dock",
};

/** Which room the saved stage strengthens (VISUAL_DESIGN §9). */
export const STAGE_ROOMS: Record<ProjectStage, Department> = {
  discovery: "research_archive",
  planning: "planning_bay",
  building: "build_workshop",
  testing: "testing_lab",
  reviewing: "memory_vault",
  shipping: "delivery_dock",
  maintenance: "command_core",
};

export function deriveSceneState(state: DashboardState): SceneState {
  const stage = state.activeProject?.currentStage ?? null;
  const stageRoom = stage !== null ? STAGE_ROOMS[stage] : null;
  const open = state.currentActivity.openEvents;

  const latestByDepartment = new Map<Department, { failed: boolean }>();
  // Timeline is newest first; keep only the newest entry per department.
  for (const event of state.timeline) {
    if (!latestByDepartment.has(event.department)) {
      latestByDepartment.set(event.department, { failed: event.status === "failed" });
    }
  }

  const rooms: RoomSceneState[] = DEPARTMENTS.map((department) => ({
    department,
    label: DEPARTMENT_LABELS[department],
    stageHighlight: department === stageRoom,
    workingCount: open.filter(
      (e) =>
        e.department === department &&
        (e.status === "queued" || e.status === "travelling" || e.status === "working"),
    ).length,
    waiting: open.some((e) => e.department === department && e.status === "waiting_for_input"),
    failed: latestByDepartment.get(department)?.failed ?? false,
  }));

  const oldestOpen = open[0] ?? null;
  return {
    rooms,
    robotAt: oldestOpen?.department ?? "command_core",
    stage,
    idle: state.currentActivity.idle,
  };
}
