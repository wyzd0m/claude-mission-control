import type { DashboardState, Department, EventStatus } from "@mission-control/domain";
import {
  AMBIENT_PAUSE_POINT,
  STATIONS,
  ROOM_POSITIONS,
  pointAlongRoute,
  routeBetween,
  routeLength,
  type Point,
} from "./layout.js";

// Pure presentation state machine (visual redesign, Stage 3). Robots walk
// the office's waypoint routes — never teleporting — and animate only
// persisted Mission Control events observed through the dashboard read model:
//   - a newly observed event becomes one replay job:
//     travel → working → outcome → (travel to the next job, or return)
//   - an event that is still open loops in `working` until a later poll
//     shows its terminal status; the outcome then plays truthfully
//   - open waiting_for_input events make the robot WALK to the Approval
//     Desk and hold there; when the wait clears it walks home
//   - when idle long enough, the robot paces a short ambient line in front
//     of the Command Hub — atmosphere only, never presented as work
//   - the very first ingest marks history as seen WITHOUT animating, so a
//     reload restores the correct quiet state instead of replaying the past

export type JobOutcome = "succeeded" | "failed" | "cancelled" | "open";
export type JobKind = "task" | "ambient" | "reposition";
export type AnimationPhase = "travel" | "working" | "outcome" | "return";
export type RestPoint = "command_core" | "security_gate";

/** What the animator is presenting right now, for room lighting. */
export interface LiveActivity {
  department: Department;
  phase: "working" | "outcome" | "gate";
  outcome: JobOutcome | null;
}

export interface AnimationJob {
  eventId: string;
  department: Department;
  outcome: JobOutcome;
  kind: JobKind;
}

export interface CurrentAnimation {
  job: AnimationJob;
  phase: AnimationPhase;
  elapsed: number;
  /** Walking route for travel/return phases. */
  route: Point[];
  length: number;
  duration: number;
  /** Where a return leg ends (the job keeps its own department). */
  restTarget?: RestPoint;
}

export interface AnimatorState {
  initialized: boolean;
  seen: Record<string, EventStatus>;
  queue: AnimationJob[];
  current: CurrentAnimation | null;
  holdAtGate: boolean;
  /** Where the robot stands when it has nothing to do. */
  restAt: RestPoint;
  idleElapsed: number;
}

export const ROBOT_SPEED = 3.4; // world units per second
export const AMBIENT_INTERVAL = 12; // seconds of idleness before a pace
export const PHASE_DURATIONS = {
  working: 1.8,
  outcome: 0.9,
  ambientPause: 1.6,
} as const;

const MAX_QUEUE = 4;
const TERMINAL: readonly EventStatus[] = ["succeeded", "failed", "cancelled"];

export function travelDuration(length: number): number {
  return Math.min(Math.max(length / ROBOT_SPEED, 0.7), 4.5);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function createAnimator(): AnimatorState {
  return {
    initialized: false,
    seen: {},
    queue: [],
    current: null,
    holdAtGate: false,
    restAt: "command_core",
    idleElapsed: 0,
  };
}

function outcomeOf(status: EventStatus): JobOutcome {
  return TERMINAL.includes(status) ? (status as JobOutcome) : "open";
}

function travelAnimation(
  job: AnimationJob,
  route: Point[],
  phase: "travel" | "return" = "travel",
): CurrentAnimation {
  const length = routeLength(route);
  return { job, phase, elapsed: 0, route, length, duration: travelDuration(length) };
}

/** Observe the latest read model. Pure; never mutates. */
export function ingest(state: AnimatorState, dashboard: DashboardState): AnimatorState {
  const holdAtGate = dashboard.currentActivity.openEvents.some(
    (e) => e.status === "waiting_for_input",
  );
  const observed = [...dashboard.timeline, ...dashboard.currentActivity.openEvents];

  const seen: Record<string, EventStatus> = { ...state.seen };
  if (!state.initialized) {
    for (const event of observed) {
      seen[event.id] = event.status;
    }
    return { ...state, initialized: true, seen, holdAtGate };
  }

  const newJobs: AnimationJob[] = [];
  for (const event of [...dashboard.timeline].reverse()) {
    if (!(event.id in seen)) {
      newJobs.push({
        eventId: event.id,
        department: event.department,
        outcome: outcomeOf(event.status),
        kind: "task",
      });
    }
    seen[event.id] = event.status;
  }
  for (const event of dashboard.currentActivity.openEvents) {
    if (!(event.id in seen) && event.status !== "waiting_for_input") {
      newJobs.push({
        eventId: event.id,
        department: event.department,
        outcome: "open",
        kind: "task",
      });
    }
    seen[event.id] = event.status;
  }

  const updateJob = (job: AnimationJob): AnimationJob => {
    const status = seen[job.eventId];
    return status !== undefined && job.outcome === "open" && job.kind === "task"
      ? { ...job, outcome: outcomeOf(status) }
      : job;
  };
  const queue = [...state.queue.map(updateJob), ...newJobs].slice(-MAX_QUEUE);
  const current = state.current ? { ...state.current, job: updateJob(state.current.job) } : null;

  return { ...state, seen, queue, current, holdAtGate, idleElapsed: 0 };
}

function ambientJob(): AnimationJob {
  return { eventId: "__ambient", department: "command_core", outcome: "open", kind: "ambient" };
}

function repositionJob(target: RestPoint): AnimationJob {
  return {
    eventId: `__reposition:${target}`,
    department: target,
    outcome: "open",
    kind: "reposition",
  };
}

/** Advance the animation clock. Pure: returns the next state. */
export function tick(state: AnimatorState, dt: number): AnimatorState {
  if (!state.initialized) return state;

  let { current } = state;

  // A real job preempts ambient pacing instantly. Ambient stays on the
  // Command Hub's entrance lane, so prepending the robot's live position to
  // a core-starting route keeps the whole path on open floor.
  const nextReal = state.queue[0];
  if (current !== null && current.job.kind === "ambient" && nextReal !== undefined) {
    const here = robotPlacement(state).position;
    const base = routeBetween("command_core", nextReal.department);
    current = travelAnimation(nextReal, [here, ...base]);
    return { ...state, queue: state.queue.slice(1), current, idleElapsed: 0 };
  }

  if (current !== null) {
    const elapsed = current.elapsed + dt;
    const duration =
      current.phase === "travel" || current.phase === "return"
        ? current.duration
        : current.phase === "working"
          ? current.job.kind === "ambient"
            ? PHASE_DURATIONS.ambientPause
            : PHASE_DURATIONS.working
          : PHASE_DURATIONS.outcome;

    // An open task keeps working until its event completes.
    if (
      current.phase === "working" &&
      current.job.kind === "task" &&
      current.job.outcome === "open"
    ) {
      return { ...state, current: { ...current, elapsed: Math.min(elapsed, duration) } };
    }

    if (elapsed < duration) {
      return { ...state, current: { ...current, elapsed } };
    }

    switch (current.phase) {
      case "travel": {
        if (current.job.kind === "reposition") {
          return { ...state, current: null, restAt: current.job.department as RestPoint };
        }
        return { ...state, current: { ...current, phase: "working", elapsed: 0 } };
      }
      case "working": {
        if (current.job.kind === "ambient") {
          const back = [...current.route].reverse();
          return { ...state, current: travelAnimation(current.job, back, "return") };
        }
        return { ...state, current: { ...current, phase: "outcome", elapsed: 0 } };
      }
      case "outcome": {
        const [next, ...rest] = state.queue;
        if (next !== undefined) {
          const route = routeBetween(current.job.department, next.department);
          return { ...state, queue: rest, current: travelAnimation(next, route) };
        }
        const home: RestPoint = state.holdAtGate ? "security_gate" : "command_core";
        const route = routeBetween(current.job.department, home);
        return {
          ...state,
          current: { ...travelAnimation(current.job, route, "return"), restTarget: home },
        };
      }
      case "return": {
        if (current.job.kind === "ambient") {
          return { ...state, current: null, idleElapsed: 0 };
        }
        return { ...state, current: null, restAt: current.restTarget ?? "command_core" };
      }
    }
  }

  // Nothing playing: start queued work, walk to/from the gate, or idle.
  const [next, ...rest] = state.queue;
  if (next !== undefined) {
    const route = routeBetween(state.restAt, next.department);
    return { ...state, queue: rest, current: travelAnimation(next, route), idleElapsed: 0 };
  }
  if (state.holdAtGate && state.restAt !== "security_gate") {
    const route = routeBetween(state.restAt, "security_gate");
    return { ...state, current: travelAnimation(repositionJob("security_gate"), route) };
  }
  if (!state.holdAtGate && state.restAt !== "command_core") {
    const route = routeBetween(state.restAt, "command_core");
    return { ...state, current: travelAnimation(repositionJob("command_core"), route) };
  }

  const idleElapsed = state.idleElapsed + dt;
  if (idleElapsed >= AMBIENT_INTERVAL && state.restAt === "command_core") {
    const route: Point[] = [STATIONS.command_core, AMBIENT_PAUSE_POINT];
    return { ...state, idleElapsed: 0, current: travelAnimation(ambientJob(), route) };
  }
  return { ...state, idleElapsed };
}

export interface RobotPlacement {
  position: Point;
  /** Y-rotation the robot faces (its front is +z). */
  heading: number;
  phase: AnimationPhase | "idle" | "gate" | "ambient";
  /** Normalized movement speed (0 when stationary), for wheel animation. */
  speed: number;
  activeDepartment: Department | null;
  outcome: JobOutcome | null;
  /** Department whose symbolic output the robot is carrying home. */
  carrying: Department | null;
}

/** Face from a station toward its room's center. */
function stationHeading(department: Department): number {
  const [sx, sz] = STATIONS[department];
  const [cx, cz] = ROOM_POSITIONS[department];
  if (Math.abs(cx - sx) < 1e-6 && Math.abs(cz - sz) < 1e-6) return Math.PI;
  return Math.atan2(cx - sx, cz - sz);
}

export function robotPlacement(state: AnimatorState): RobotPlacement {
  const none = {
    speed: 0,
    activeDepartment: null as Department | null,
    outcome: null as JobOutcome | null,
    carrying: null as Department | null,
  };
  const { current } = state;

  if (current !== null) {
    if (current.phase === "travel" || current.phase === "return") {
      const t = Math.min(current.elapsed / current.duration, 1);
      const eased = easeInOut(t);
      const { position, heading } = pointAlongRoute(current.route, eased * current.length);
      const speed = Math.max(0, 6 * t * (1 - t)); // smoothstep derivative shape
      const ambient = current.job.kind === "ambient";
      return {
        ...none,
        position,
        heading,
        speed: Math.min(speed, 1.4),
        phase: ambient ? "ambient" : current.phase,
        carrying:
          current.phase === "return" &&
          current.job.kind === "task" &&
          current.job.outcome === "succeeded"
            ? current.job.department
            : null,
      };
    }
    if (current.phase === "working") {
      if (current.job.kind === "ambient") {
        return { ...none, position: AMBIENT_PAUSE_POINT, heading: 0, phase: "ambient" };
      }
      return {
        ...none,
        position: STATIONS[current.job.department],
        heading: stationHeading(current.job.department),
        phase: "working",
        activeDepartment: current.job.department,
      };
    }
    // outcome
    return {
      ...none,
      position: STATIONS[current.job.department],
      heading: stationHeading(current.job.department),
      phase: "outcome",
      activeDepartment: current.job.department,
      outcome: current.job.outcome,
    };
  }

  if (state.holdAtGate && state.restAt === "security_gate") {
    return {
      ...none,
      position: STATIONS.security_gate,
      heading: stationHeading("security_gate"),
      phase: "gate",
      activeDepartment: "security_gate",
    };
  }
  return {
    ...none,
    position: STATIONS[state.restAt],
    heading: state.restAt === "command_core" ? 0 : stationHeading(state.restAt),
    phase: "idle",
  };
}

/** Route to highlight on the floor while a task robot is travelling. */
export function activeRoute(state: AnimatorState): Point[] | null {
  const { current } = state;
  if (current !== null && current.job.kind === "task" && current.phase === "travel") {
    return current.route;
  }
  return null;
}
