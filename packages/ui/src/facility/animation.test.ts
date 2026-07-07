// Animator tests (docs/TESTING_STRATEGY.md "3D state tests"): correct route
// and phase order, truthful outcomes, Security Gate hold, multi-event queue
// without corruption, and reload restoring quiet state instead of replaying.
import { describe, expect, it } from "vitest";
import type { ActivityEvent, DashboardState } from "@mission-control/domain";
import {
  createAnimator,
  ingest,
  tick,
  robotPlacement,
  robotWorldPosition,
  PHASE_DURATIONS,
  type AnimatorState,
} from "./animation.js";

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

function dashboard(timeline: ActivityEvent[], openEvents: ActivityEvent[] = []): DashboardState {
  return {
    generatedAt: NOW,
    serverVersion: "0.1.0",
    projects: [],
    activeProjectId: null,
    activeProject: null,
    projectProgress: null,
    tasks: [],
    decisions: [],
    latestCheckpoint: null,
    currentActivity: { openEvents, idle: openEvents.length === 0, idleMessage: null },
    timeline,
  };
}

/** Advance until the current phase changes or maxSeconds passes. */
function play(state: AnimatorState, seconds: number, step = 0.1): AnimatorState {
  let s = state;
  for (let t = 0; t < seconds; t += step) {
    s = tick(s, step);
  }
  return s;
}

describe("animator", () => {
  it("marks history as seen on first ingest without replaying (reload safety)", () => {
    const s = ingest(createAnimator(), dashboard([event({ id: "old" })]));
    expect(s.queue).toHaveLength(0);
    expect(s.current).toBeNull();
    expect(robotPlacement(s).phase).toBe("idle");
  });

  it("replays a newly observed terminal event through the full sequence", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = ingest(s, dashboard([event({ id: "new1", department: "memory_vault" })]));
    expect(s.queue).toHaveLength(1);

    s = tick(s, 0.01); // pick up the job
    expect(robotPlacement(s).phase).toBe("travel");
    expect(robotPlacement(s).to).toBe("memory_vault");

    s = play(s, PHASE_DURATIONS.travel + 0.05);
    expect(robotPlacement(s).phase).toBe("working");
    expect(robotPlacement(s).activeDepartment).toBe("memory_vault");

    s = play(s, PHASE_DURATIONS.working + 0.05);
    const outcome = robotPlacement(s);
    expect(outcome.phase).toBe("outcome");
    expect(outcome.outcome).toBe("succeeded");

    s = play(s, PHASE_DURATIONS.outcome + 0.05);
    expect(robotPlacement(s).phase).toBe("return");
    s = play(s, PHASE_DURATIONS.return + 0.05);
    expect(robotPlacement(s).phase).toBe("idle");
  });

  it("keeps an open event working until its terminal status arrives", () => {
    let s = ingest(createAnimator(), dashboard([]));
    const open = event({
      id: "op1",
      status: "working",
      department: "build_workshop",
      completedAt: null,
    });
    s = ingest(s, dashboard([], [open]));
    s = tick(s, 0.01);
    s = play(s, PHASE_DURATIONS.travel + PHASE_DURATIONS.working + 5);
    // Still working: no invented completion.
    expect(robotPlacement(s).phase).toBe("working");

    const done = event({ id: "op1", status: "failed", department: "build_workshop" });
    s = ingest(s, dashboard([done]));
    s = play(s, 0.2);
    expect(robotPlacement(s).phase).toBe("outcome");
    expect(robotPlacement(s).outcome).toBe("failed");
  });

  it("queues multiple new events and travels room-to-room without returning between", () => {
    let s = ingest(createAnimator(), dashboard([]));
    // Timeline newest first: e2 is newer than e1.
    s = ingest(
      s,
      dashboard([
        event({ id: "e2", department: "testing_lab" }),
        event({ id: "e1", department: "planning_bay" }),
      ]),
    );
    expect(s.queue.map((j) => j.department)).toEqual(["planning_bay", "testing_lab"]);

    s = tick(s, 0.01);
    s = play(s, PHASE_DURATIONS.travel + PHASE_DURATIONS.working + PHASE_DURATIONS.outcome + 0.2);
    const placement = robotPlacement(s);
    expect(placement.phase).toBe("travel");
    expect(placement.from).toBe("planning_bay");
    expect(placement.to).toBe("testing_lab");
  });

  it("does not re-animate events on repeated ingests (no corruption)", () => {
    let s = ingest(createAnimator(), dashboard([]));
    const e = event({ id: "e1" });
    s = ingest(s, dashboard([e]));
    s = ingest(s, dashboard([e]));
    s = ingest(s, dashboard([e]));
    expect(s.queue).toHaveLength(1);
  });

  it("holds the robot at the Security Gate while an approval is open", () => {
    let s = ingest(createAnimator(), dashboard([]));
    const waiting = event({
      id: "w1",
      status: "waiting_for_input",
      requiresInput: true,
      department: "security_gate",
      completedAt: null,
    });
    s = ingest(s, dashboard([], [waiting]));
    // Waiting events do not create replay jobs; the hold is state-driven.
    expect(s.queue).toHaveLength(0);
    const placement = robotPlacement(s);
    expect(placement.phase).toBe("gate");
    expect(placement.activeDepartment).toBe("security_gate");

    s = ingest(
      s,
      dashboard([event({ id: "w1", status: "cancelled", department: "security_gate" })]),
    );
    expect(robotPlacement(s).phase).toBe("idle");
  });

  it("caps the replay queue instead of growing without bound", () => {
    let s = ingest(createAnimator(), dashboard([]));
    const many = Array.from({ length: 10 }, (_, i) =>
      event({ id: `bulk-${i}`, department: "planning_bay" }),
    );
    s = ingest(s, dashboard(many));
    expect(s.queue.length).toBeLessThanOrEqual(4);
  });

  it("interpolates world positions along the path", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = ingest(s, dashboard([event({ id: "e1", department: "build_workshop" })]));
    s = tick(s, 0.01);
    s = play(s, PHASE_DURATIONS.travel / 2);
    const [x, z] = robotWorldPosition(robotPlacement(s));
    // Between command_core [0,0] and build_workshop [7,0].
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(7);
    expect(z).toBe(0);
  });
});
