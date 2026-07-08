// Animator tests (visual redesign, Stage 3): route-following travel with no
// teleports, truthful outcomes, walking to and from the Approval Desk,
// subtle ambient idling that real work preempts seamlessly, and reload
// restoring quiet state instead of replaying history.
import { describe, expect, it } from "vitest";
import type { ActivityEvent, DashboardState } from "@mission-control/domain";
import {
  createAnimator,
  ingest,
  tick,
  robotPlacement,
  activeRoute,
  travelDuration,
  AMBIENT_INTERVAL,
  PHASE_DURATIONS,
  type AnimatorState,
} from "./animation.js";
import { routeBetween, routeLength, STATIONS } from "./layout.js";

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

function play(state: AnimatorState, seconds: number, step = 0.05): AnimatorState {
  let s = state;
  for (let t = 0; t < seconds; t += step) {
    s = tick(s, step);
  }
  return s;
}

function travelTime(
  from: Parameters<typeof routeBetween>[0],
  to: Parameters<typeof routeBetween>[1],
) {
  return travelDuration(routeLength(routeBetween(from, to)));
}

describe("animator", () => {
  it("marks history as seen on first ingest without replaying (reload safety)", () => {
    const s = ingest(createAnimator(), dashboard([event({ id: "old" })]));
    expect(s.queue).toHaveLength(0);
    expect(s.current).toBeNull();
    expect(robotPlacement(s).phase).toBe("idle");
    expect(robotPlacement(s).position).toEqual(STATIONS.command_core);
  });

  it("replays a new event: walks the route, works at the station, shows the outcome, returns", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = ingest(s, dashboard([event({ id: "new1", department: "memory_vault" })]));

    s = tick(s, 0.01);
    expect(robotPlacement(s).phase).toBe("travel");
    expect(activeRoute(s)).not.toBeNull();

    s = play(s, travelTime("command_core", "memory_vault") + 0.1);
    const working = robotPlacement(s);
    expect(working.phase).toBe("working");
    expect(working.activeDepartment).toBe("memory_vault");
    expect(working.position).toEqual(STATIONS.memory_vault);

    s = play(s, PHASE_DURATIONS.working + 0.1);
    const outcome = robotPlacement(s);
    expect(outcome.phase).toBe("outcome");
    expect(outcome.outcome).toBe("succeeded");

    s = play(s, PHASE_DURATIONS.outcome + 0.1);
    const returning = robotPlacement(s);
    expect(returning.phase).toBe("return");
    expect(returning.carrying).toBe("memory_vault");

    s = play(s, travelTime("memory_vault", "command_core") + 0.1);
    expect(robotPlacement(s).phase).toBe("idle");
    expect(robotPlacement(s).position).toEqual(STATIONS.command_core);
  });

  it("never teleports: successive positions stay within walking distance", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = ingest(s, dashboard([event({ id: "n1", department: "testing_lab" })]));
    let previous = robotPlacement(s).position;
    for (let i = 0; i < 400; i++) {
      s = tick(s, 0.05);
      const next = robotPlacement(s).position;
      const jump = Math.hypot(next[0] - previous[0], next[1] - previous[1]);
      expect(jump).toBeLessThan(0.5);
      previous = next;
    }
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
    s = play(s, travelTime("command_core", "build_workshop") + PHASE_DURATIONS.working + 5);
    expect(robotPlacement(s).phase).toBe("working");

    s = ingest(
      s,
      dashboard([event({ id: "op1", status: "failed", department: "build_workshop" })]),
    );
    s = play(s, 0.3);
    expect(robotPlacement(s).phase).toBe("outcome");
    expect(robotPlacement(s).outcome).toBe("failed");
  });

  it("chains queued jobs room-to-room without returning between", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = ingest(
      s,
      dashboard([
        event({ id: "e2", department: "testing_lab" }),
        event({ id: "e1", department: "planning_bay" }),
      ]),
    );
    expect(s.queue.map((j) => j.department)).toEqual(["planning_bay", "testing_lab"]);

    s = play(
      s,
      travelTime("command_core", "planning_bay") +
        PHASE_DURATIONS.working +
        PHASE_DURATIONS.outcome +
        0.3,
    );
    const placement = robotPlacement(s);
    expect(placement.phase).toBe("travel");
    const route = activeRoute(s)!;
    expect(route[0]).toEqual(STATIONS.planning_bay);
    expect(route[route.length - 1]).toEqual(STATIONS.testing_lab);
  });

  it("does not re-animate events on repeated ingests", () => {
    let s = ingest(createAnimator(), dashboard([]));
    const e = event({ id: "e1" });
    s = ingest(s, dashboard([e]));
    s = ingest(s, dashboard([e]));
    expect(s.queue).toHaveLength(1);
  });

  it("walks to the Approval Desk for an open wait and walks home afterwards", () => {
    let s = ingest(createAnimator(), dashboard([]));
    const waiting = event({
      id: "w1",
      status: "waiting_for_input",
      requiresInput: true,
      department: "security_gate",
      completedAt: null,
    });
    s = ingest(s, dashboard([], [waiting]));

    s = tick(s, 0.05);
    expect(robotPlacement(s).phase).toBe("travel"); // walking, not teleporting

    s = play(s, travelTime("command_core", "security_gate") + 0.2);
    const atGate = robotPlacement(s);
    expect(atGate.phase).toBe("gate");
    expect(atGate.position).toEqual(STATIONS.security_gate);
    expect(atGate.activeDepartment).toBe("security_gate");

    s = ingest(
      s,
      dashboard([event({ id: "w1", status: "cancelled", department: "security_gate" })]),
    );
    s = play(s, travelTime("security_gate", "command_core") + 0.3);
    expect(robotPlacement(s).phase).toBe("idle");
    expect(robotPlacement(s).position).toEqual(STATIONS.command_core);
  });

  it("paces a short ambient line when idle, without lighting any room", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = play(s, AMBIENT_INTERVAL + 0.2);
    const placement = robotPlacement(s);
    expect(placement.phase).toBe("ambient");
    expect(placement.activeDepartment).toBeNull();
    expect(activeRoute(s)).toBeNull(); // ambient never highlights a route
  });

  it("lets real work preempt ambient pacing without a position jump", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = play(s, AMBIENT_INTERVAL + 0.6);
    const before = robotPlacement(s).position;

    s = ingest(s, dashboard([event({ id: "task1", department: "planning_bay" })]));
    s = tick(s, 0.05);
    const after = robotPlacement(s);
    expect(after.phase).toBe("travel");
    const jump = Math.hypot(after.position[0] - before[0], after.position[1] - before[1]);
    expect(jump).toBeLessThan(0.5);
  });

  it("caps the replay queue instead of growing without bound", () => {
    let s = ingest(createAnimator(), dashboard([]));
    const many = Array.from({ length: 10 }, (_, i) =>
      event({ id: `bulk-${i}`, department: "planning_bay" }),
    );
    s = ingest(s, dashboard(many));
    expect(s.queue.length).toBeLessThanOrEqual(4);
  });
});
