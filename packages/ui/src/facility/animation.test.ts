// Animator tests (visual redesign, Stage 3; fleet in D-028): route-following
// travel with no teleports, truthful outcomes, concurrent jobs dispatched
// across a capped robot fleet, walking to and from the Approval Desk, subtle
// ambient idling that real work preempts seamlessly, and reload restoring
// quiet state instead of replaying history.
import { describe, expect, it } from "vitest";
import type { ActivityEvent, DashboardState } from "@mission-control/domain";
import {
  createAnimator,
  ingest,
  tick,
  robotPlacements,
  activeRoutes,
  travelDuration,
  AMBIENT_INTERVAL,
  PHASE_DURATIONS,
  ROBOT_COUNT,
  type AnimatorState,
} from "./animation.js";
import { ROBOT_HOME_POINTS, routeBetween, routeLength, STATIONS } from "./layout.js";

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
    const placements = robotPlacements(s);
    expect(placements).toHaveLength(ROBOT_COUNT);
    for (const [i, placement] of placements.entries()) {
      expect(placement.phase).toBe("idle");
      expect(placement.position).toEqual(ROBOT_HOME_POINTS[i]);
    }
  });

  it("replays a new event: walks the route, works at the station, shows the outcome, returns", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = ingest(s, dashboard([event({ id: "new1", department: "memory_vault" })]));

    s = tick(s, 0.01);
    expect(robotPlacements(s)[0]!.phase).toBe("travel");
    expect(activeRoutes(s)).toHaveLength(1);

    s = play(s, travelTime("command_core", "memory_vault") + 0.1);
    const working = robotPlacements(s)[0]!;
    expect(working.phase).toBe("working");
    expect(working.activeDepartment).toBe("memory_vault");
    expect(working.position).toEqual(STATIONS.memory_vault);

    s = play(s, PHASE_DURATIONS.working + 0.1);
    const outcome = robotPlacements(s)[0]!;
    expect(outcome.phase).toBe("outcome");
    expect(outcome.outcome).toBe("succeeded");

    s = play(s, PHASE_DURATIONS.outcome + 0.1);
    const returning = robotPlacements(s)[0]!;
    expect(returning.phase).toBe("return");
    expect(returning.carrying).toBe("memory_vault");

    s = play(s, travelTime("memory_vault", "command_core") + 0.1);
    expect(robotPlacements(s)[0]!.phase).toBe("idle");
    expect(robotPlacements(s)[0]!.position).toEqual(STATIONS.command_core);
  });

  it("dispatches concurrent jobs to different robots", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = ingest(
      s,
      dashboard([
        event({ id: "c2", department: "testing_lab" }),
        event({ id: "c1", department: "planning_bay" }),
      ]),
    );
    s = tick(s, 0.01);

    const placements = robotPlacements(s);
    expect(placements[0]!.phase).toBe("travel");
    expect(placements[1]!.phase).toBe("travel");
    expect(placements[2]!.phase).toBe("idle");
    expect(activeRoutes(s)).toHaveLength(2);

    // Each robot arrives at its own department.
    s = play(s, 4.6);
    const arrived = robotPlacements(s);
    const active = arrived
      .map((p) => p.activeDepartment)
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort();
    expect(active).toEqual(["planning_bay", "testing_lab"]);
  });

  it("never teleports: successive positions stay within walking distance", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = ingest(
      s,
      dashboard([
        event({ id: "n1", department: "testing_lab" }),
        event({ id: "n2", department: "delivery_dock" }),
      ]),
    );
    let previous = robotPlacements(s).map((p) => p.position);
    for (let i = 0; i < 400; i++) {
      s = tick(s, 0.05);
      const next = robotPlacements(s).map((p) => p.position);
      for (let r = 0; r < next.length; r++) {
        const jump = Math.hypot(next[r]![0] - previous[r]![0], next[r]![1] - previous[r]![1]);
        expect(jump).toBeLessThan(0.5);
      }
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
    expect(robotPlacements(s)[0]!.phase).toBe("working");

    s = ingest(
      s,
      dashboard([event({ id: "op1", status: "failed", department: "build_workshop" })]),
    );
    s = play(s, 0.3);
    expect(robotPlacements(s)[0]!.phase).toBe("outcome");
    expect(robotPlacements(s)[0]!.outcome).toBe("failed");
  });

  it("chains overflow jobs room-to-room once the fleet is saturated", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = ingest(
      s,
      dashboard([
        event({ id: "e4", department: "build_workshop" }),
        event({ id: "e3", department: "memory_vault" }),
        event({ id: "e2", department: "testing_lab" }),
        event({ id: "e1", department: "planning_bay" }),
      ]),
    );
    s = tick(s, 0.01);
    expect(s.queue.map((j) => j.department)).toEqual(["build_workshop"]);

    // Robot 0 finishes planning_bay first (shortest route) and must pick up
    // the overflow job, walking room-to-room without returning home.
    s = play(
      s,
      travelTime("command_core", "planning_bay") +
        PHASE_DURATIONS.working +
        PHASE_DURATIONS.outcome +
        0.3,
    );
    const placement = robotPlacements(s)[0]!;
    expect(placement.phase).toBe("travel");
    const chained = activeRoutes(s).find(
      (route) =>
        route[0]![0] === STATIONS.planning_bay[0] && route[0]![1] === STATIONS.planning_bay[1],
    );
    expect(chained).toBeDefined();
    expect(chained![chained!.length - 1]).toEqual(STATIONS.build_workshop);
  });

  it("does not re-animate events on repeated ingests", () => {
    let s = ingest(createAnimator(), dashboard([]));
    const e = event({ id: "e1" });
    s = ingest(s, dashboard([e]));
    s = ingest(s, dashboard([e]));
    expect(s.queue).toHaveLength(1);
  });

  it("sends exactly one robot to the Approval Desk for an open wait", () => {
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
    const enRoute = robotPlacements(s).filter((p) => p.phase === "travel");
    expect(enRoute).toHaveLength(1); // one robot walks, the rest stay parked

    s = play(s, travelTime("command_core", "security_gate") + 0.2);
    const placements = robotPlacements(s);
    const atGate = placements.filter((p) => p.phase === "gate");
    expect(atGate).toHaveLength(1);
    expect(atGate[0]!.position).toEqual(STATIONS.security_gate);
    expect(atGate[0]!.activeDepartment).toBe("security_gate");

    s = ingest(
      s,
      dashboard([event({ id: "w1", status: "cancelled", department: "security_gate" })]),
    );
    s = play(s, travelTime("security_gate", "command_core") + 0.3);
    for (const [i, placement] of robotPlacements(s).entries()) {
      expect(placement.phase).toBe("idle");
      expect(placement.position).toEqual(ROBOT_HOME_POINTS[i]);
    }
  });

  it("paces a short ambient line when the whole fleet is idle, without lighting any room", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = play(s, AMBIENT_INTERVAL + 0.2);
    const placements = robotPlacements(s);
    expect(placements[0]!.phase).toBe("ambient");
    expect(placements[0]!.activeDepartment).toBeNull();
    expect(placements[1]!.phase).toBe("idle");
    expect(placements[2]!.phase).toBe("idle");
    expect(activeRoutes(s)).toHaveLength(0); // ambient never highlights a route
  });

  it("lets real work preempt ambient pacing without a position jump", () => {
    let s = ingest(createAnimator(), dashboard([]));
    s = play(s, AMBIENT_INTERVAL + 0.6);
    const before = robotPlacements(s)[0]!.position;

    // Three jobs: two go to the parked robots, the third takes over the
    // ambient pacer from its live position.
    s = ingest(
      s,
      dashboard([
        event({ id: "t3", department: "memory_vault" }),
        event({ id: "t2", department: "testing_lab" }),
        event({ id: "t1", department: "planning_bay" }),
      ]),
    );
    s = tick(s, 0.05);
    const after = robotPlacements(s);
    expect(after.every((p) => p.phase === "travel")).toBe(true);
    const jump = Math.hypot(after[0]!.position[0] - before[0], after[0]!.position[1] - before[1]);
    expect(jump).toBeLessThan(0.5);
  });

  it("caps the replay queue instead of growing without bound", () => {
    let s = ingest(createAnimator(), dashboard([]));
    const many = Array.from({ length: 12 }, (_, i) =>
      event({ id: `bulk-${i}`, department: "planning_bay" }),
    );
    s = ingest(s, dashboard(many));
    expect(s.queue.length).toBeLessThanOrEqual(6);
  });
});
