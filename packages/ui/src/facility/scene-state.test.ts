// Deterministic scene-state tests (docs/TESTING_STRATEGY.md "3D state
// tests"): correct room activation, robot placement, Security Gate waiting
// state, failure indicators, and an honest idle scene.
import { describe, expect, it } from "vitest";
import type { ActivityEvent, DashboardState } from "@mission-control/domain";
import { deriveSceneState } from "./scene-state.js";

const NOW = "2026-07-05T12:00:00.000Z";

function event(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: "e1",
    projectId: "p1",
    correlationId: "c1",
    toolName: "create_task",
    displayLabel: "Creating a task",
    department: "planning_bay",
    status: "succeeded",
    startedAt: NOW,
    updatedAt: NOW,
    completedAt: NOW,
    progressCurrent: null,
    progressTotal: null,
    progressMessage: null,
    relatedTaskIds: [],
    requiresInput: false,
    resultSummary: null,
    errorCode: null,
    errorSummary: null,
    ...overrides,
  };
}

function state(overrides: Partial<DashboardState> = {}): DashboardState {
  return {
    generatedAt: NOW,
    serverVersion: "0.1.0",
    projects: [],
    activeProjectId: "p1",
    activeProject: {
      id: "p1",
      name: "Demo",
      description: "",
      goal: "",
      definitionOfDone: "",
      currentStage: "building",
      status: "active",
      revision: 1,
      createdAt: NOW,
      updatedAt: NOW,
    },
    projectProgress: null,
    tasks: [],
    decisions: [],
    latestCheckpoint: null,
    currentActivity: { openEvents: [], idle: true, idleMessage: "idle" },
    timeline: [],
    ...overrides,
  };
}

function room(scene: ReturnType<typeof deriveSceneState>, department: string) {
  return scene.rooms.find((r) => r.department === department)!;
}

describe("deriveSceneState", () => {
  it("parks the robot at Command Core when idle", () => {
    const scene = deriveSceneState(state());
    expect(scene.idle).toBe(true);
    expect(scene.robotAt).toBe("command_core");
    expect(scene.rooms.every((r) => r.workingCount === 0 && !r.waiting)).toBe(true);
  });

  it("strengthens only the saved stage's room", () => {
    const scene = deriveSceneState(state());
    expect(room(scene, "build_workshop").stageHighlight).toBe(true);
    expect(scene.rooms.filter((r) => r.stageHighlight)).toHaveLength(1);
  });

  it("has no stage highlight without an active project", () => {
    const scene = deriveSceneState(state({ activeProject: null, activeProjectId: null }));
    expect(scene.rooms.some((r) => r.stageHighlight)).toBe(false);
    expect(scene.stage).toBeNull();
  });

  it("sends the robot to the department of the open event", () => {
    const working = event({ id: "e2", status: "working", department: "memory_vault" });
    const scene = deriveSceneState(
      state({ currentActivity: { openEvents: [working], idle: false, idleMessage: null } }),
    );
    expect(scene.robotAt).toBe("memory_vault");
    expect(room(scene, "memory_vault").workingCount).toBe(1);
  });

  it("marks the Security Gate waiting state", () => {
    const waiting = event({
      id: "e3",
      status: "waiting_for_input",
      requiresInput: true,
      department: "security_gate",
    });
    const scene = deriveSceneState(
      state({ currentActivity: { openEvents: [waiting], idle: false, idleMessage: null } }),
    );
    expect(room(scene, "security_gate").waiting).toBe(true);
    expect(room(scene, "security_gate").workingCount).toBe(0);
  });

  it("flags a room whose most recent event failed, and clears it after a success", () => {
    const failed = event({ id: "e4", status: "failed", department: "testing_lab" });
    const failedScene = deriveSceneState(state({ timeline: [failed] }));
    expect(room(failedScene, "testing_lab").failed).toBe(true);

    const laterSuccess = event({ id: "e5", status: "succeeded", department: "testing_lab" });
    // Timeline is newest first.
    const recovered = deriveSceneState(state({ timeline: [laterSuccess, failed] }));
    expect(room(recovered, "testing_lab").failed).toBe(false);
  });

  it("never activates rooms without observable events", () => {
    const scene = deriveSceneState(state({ timeline: [event({ department: "planning_bay" })] }));
    for (const r of scene.rooms) {
      expect(r.workingCount).toBe(0);
      expect(r.waiting).toBe(false);
    }
  });
});
