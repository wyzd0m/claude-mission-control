import type { DashboardState, Department, EventStatus } from "@mission-control/domain";
import {
  AMBIENT_LINES,
  ROBOT_HOME_POINTS,
  STATIONS,
  ROOM_POSITIONS,
  pointAlongRoute,
  routeBetween,
  routeLength,
  type Point,
} from "./layout.js";

// Pure presentation state machine (visual redesign, Stage 3; fleet in
// D-028). A capped fleet of robots walks the office's waypoint routes —
// never teleporting — and animates only persisted Mission Control events
// observed through the dashboard read model:
//   - a newly observed event becomes one replay job:
//     travel → working → outcome → (travel to the next job, or return)
//   - jobs are dispatched to idle robots, so concurrent operations animate
//     concurrently; when jobs outnumber robots they chain room-to-room
//   - an event that is still open loops in `working` until a later poll
//     shows its terminal status; the outcome then plays truthfully
//   - open waiting_for_input events send one robot WALKING to the Approval
//     Desk to hold there; when the wait clears it walks home
//   - a robot idle at the hub long enough alternates two ambient behaviors
//     on its own staggered clock: pacing a short line near its parking spot
//     and fidgeting in place — atmosphere only, never presented as work,
//     never inside a department room
//   - the very first ingest marks history as seen WITHOUT animating, so a
//     reload restores the correct quiet state instead of replaying the past

export type JobOutcome = "succeeded" | "failed" | "cancelled" | "open";
export type JobKind = "task" | "ambient" | "fidget" | "reposition";
export type AnimationPhase = "travel" | "working" | "outcome" | "return";
export type RestPoint = "command_core" | "security_gate";

/** What a robot is presenting right now, for room lighting. */
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

/** One robot of the fleet. */
export interface RobotUnitState {
  current: CurrentAnimation | null;
  restAt: RestPoint;
  /** Seconds this robot has been parked with nothing to do. */
  idleElapsed: number;
  /** Alternates the next ambient behavior between pace and fidget. */
  fidgetNext: boolean;
}

export interface AnimatorState {
  initialized: boolean;
  seen: Record<string, EventStatus>;
  queue: AnimationJob[];
  robots: RobotUnitState[];
  holdAtGate: boolean;
}

export const ROBOT_COUNT = ROBOT_HOME_POINTS.length;
// Deliberately unhurried: fast robots read as sliding tokens instead of
// little workers crossing a real floor.
export const ROBOT_SPEED = 2.4; // world units per second
export const AMBIENT_INTERVAL = 12; // seconds of idleness before ambient moves
export const AMBIENT_STAGGER = 5; // extra idle seconds per robot index
export const PHASE_DURATIONS = {
  // Long enough for the primary gesture plus one busy-work chore (D-031).
  working: 3.4,
  outcome: 0.9,
  ambientPause: 1.6,
  fidget: 2.4,
} as const;

const MAX_QUEUE = 6;
const TERMINAL: readonly EventStatus[] = ["succeeded", "failed", "cancelled"];

export function travelDuration(length: number): number {
  return Math.min(Math.max(length / ROBOT_SPEED, 0.8), 7.5);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function createAnimator(): AnimatorState {
  return {
    initialized: false,
    seen: {},
    queue: [],
    robots: Array.from({ length: ROBOT_COUNT }, () => ({
      current: null,
      restAt: "command_core",
      idleElapsed: 0,
      fidgetNext: false,
    })),
    holdAtGate: false,
  };
}

function outcomeOf(status: EventStatus): JobOutcome {
  return TERMINAL.includes(status) ? (status as JobOutcome) : "open";
}

/** Where robot `index` parks when idle. */
function homePoint(index: number, restAt: RestPoint): Point {
  return restAt === "security_gate" ? STATIONS.security_gate : ROBOT_HOME_POINTS[index]!;
}

/** Walking route from robot `index`'s parking spot to a department station. */
function routeFromHome(index: number, restAt: RestPoint, to: Department): Point[] {
  const base = routeBetween(restAt, to);
  const home = homePoint(index, restAt);
  const [firstX, firstZ] = base[0]!;
  if (Math.abs(home[0] - firstX) < 1e-6 && Math.abs(home[1] - firstZ) < 1e-6) return base;
  return [home, ...base];
}

/** Walking route from a department station back to a parking spot. */
function routeToHome(index: number, from: Department, restTarget: RestPoint): Point[] {
  const base = routeBetween(from, restTarget);
  const home = homePoint(index, restTarget);
  const [lastX, lastZ] = base[base.length - 1]!;
  if (Math.abs(home[0] - lastX) < 1e-6 && Math.abs(home[1] - lastZ) < 1e-6) return base;
  return [...base, home];
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
  // Fresh activity puts the fleet on alert (idle clocks restart); a plain
  // poll that observed nothing new must NOT reset them, or ambient idling
  // would never trigger while a live bridge polls every few seconds.
  const alerted = newJobs.length > 0 || holdAtGate !== state.holdAtGate;
  const robots = state.robots.map((robot) => ({
    ...robot,
    idleElapsed: alerted ? 0 : robot.idleElapsed,
    current: robot.current
      ? { ...robot.current, job: updateJob(robot.current.job) }
      : robot.current,
  }));

  return { ...state, seen, queue, robots, holdAtGate };
}

function ambientJob(index: number): AnimationJob {
  return {
    eventId: `__ambient:${index}`,
    department: "command_core",
    outcome: "open",
    kind: "ambient",
  };
}

/** In-place idle animation at the robot's parking spot. */
function fidgetAnimation(index: number): CurrentAnimation {
  const home = ROBOT_HOME_POINTS[index]!;
  return {
    job: {
      eventId: `__fidget:${index}`,
      department: "command_core",
      outcome: "open",
      kind: "fidget",
    },
    phase: "working",
    elapsed: 0,
    route: [home],
    length: 0,
    duration: PHASE_DURATIONS.fidget,
  };
}

function repositionJob(target: RestPoint): AnimationJob {
  return {
    eventId: `__reposition:${target}`,
    department: target,
    outcome: "open",
    kind: "reposition",
  };
}

/** True when some robot rests at the gate or is on its way there. */
function gateCovered(robots: RobotUnitState[]): boolean {
  return robots.some(
    (robot) =>
      (robot.current === null && robot.restAt === "security_gate") ||
      (robot.current !== null &&
        (robot.current.restTarget === "security_gate" ||
          (robot.current.job.kind === "reposition" &&
            robot.current.job.department === "security_gate"))),
  );
}

/** Advance one robot's current animation by dt. Returns [unit, queue]. */
function advanceRobot(
  index: number,
  robot: RobotUnitState,
  queue: AnimationJob[],
  holdAtGate: boolean,
  gateIsCovered: boolean,
  dt: number,
): [RobotUnitState, AnimationJob[]] {
  const current = robot.current;
  if (current === null) return [robot, queue];

  const elapsed = current.elapsed + dt;
  const duration =
    current.phase === "travel" || current.phase === "return"
      ? current.duration
      : current.phase === "working"
        ? current.job.kind === "ambient"
          ? PHASE_DURATIONS.ambientPause
          : current.job.kind === "fidget"
            ? PHASE_DURATIONS.fidget
            : PHASE_DURATIONS.working
        : PHASE_DURATIONS.outcome;

  // An open task keeps working until its event completes.
  if (
    current.phase === "working" &&
    current.job.kind === "task" &&
    current.job.outcome === "open"
  ) {
    return [{ ...robot, current: { ...current, elapsed: Math.min(elapsed, duration) } }, queue];
  }

  if (elapsed < duration) {
    return [{ ...robot, current: { ...current, elapsed } }, queue];
  }

  switch (current.phase) {
    case "travel": {
      if (current.job.kind === "reposition") {
        return [{ ...robot, current: null, restAt: current.job.department as RestPoint }, queue];
      }
      return [{ ...robot, current: { ...current, phase: "working", elapsed: 0 } }, queue];
    }
    case "working": {
      if (current.job.kind === "ambient") {
        const back = [...current.route].reverse();
        return [{ ...robot, current: travelAnimation(current.job, back, "return") }, queue];
      }
      if (current.job.kind === "fidget") {
        return [{ ...robot, current: null }, queue];
      }
      return [{ ...robot, current: { ...current, phase: "outcome", elapsed: 0 } }, queue];
    }
    case "outcome": {
      const [next, ...rest] = queue;
      if (next !== undefined) {
        const route = routeBetween(current.job.department, next.department);
        return [{ ...robot, current: travelAnimation(next, route) }, rest];
      }
      const home: RestPoint = holdAtGate && !gateIsCovered ? "security_gate" : "command_core";
      const route = routeToHome(index, current.job.department, home);
      return [
        {
          ...robot,
          current: { ...travelAnimation(current.job, route, "return"), restTarget: home },
        },
        queue,
      ];
    }
    case "return": {
      if (current.job.kind === "ambient") {
        return [{ ...robot, current: null }, queue];
      }
      return [{ ...robot, current: null, restAt: current.restTarget ?? "command_core" }, queue];
    }
  }
}

/** Advance the animation clock. Pure: returns the next state. */
export function tick(state: AnimatorState, dt: number): AnimatorState {
  if (!state.initialized) return state;

  let queue = state.queue;
  const robots = [...state.robots];

  // Advance every robot's current animation.
  for (let i = 0; i < robots.length; i++) {
    const covered = gateCovered(robots.filter((_, j) => j !== i));
    const [unit, nextQueue] = advanceRobot(i, robots[i]!, queue, state.holdAtGate, covered, dt);
    robots[i] = unit;
    queue = nextQueue;
  }

  // Dispatch queued jobs to idle robots (lowest id first, deterministic).
  for (let i = 0; i < robots.length && queue.length > 0; i++) {
    const robot = robots[i]!;
    if (robot.current !== null) continue;
    const [next, ...rest] = queue;
    robots[i] = {
      ...robot,
      idleElapsed: 0,
      current: travelAnimation(next!, routeFromHome(i, robot.restAt, next!.department)),
    };
    queue = rest;
  }

  // If jobs remain and a robot is only idling ambiently (pacing or
  // fidgeting), it takes one over seamlessly from its live position.
  if (queue.length > 0) {
    const i = robots.findIndex(
      (r) =>
        r.current !== null && (r.current.job.kind === "ambient" || r.current.job.kind === "fidget"),
    );
    if (i >= 0) {
      const here = robotPlacements({ ...state, robots, queue })[i]!.position;
      const [next, ...rest] = queue;
      const base = routeBetween("command_core", next!.department);
      robots[i] = {
        ...robots[i]!,
        idleElapsed: 0,
        current: travelAnimation(next!, [here, ...base]),
      };
      queue = rest;
    }
  }

  // Gate coverage: send one idle robot to hold at the Approval Desk, and
  // send a gate-parked robot home once the wait clears.
  if (state.holdAtGate && !gateCovered(robots)) {
    const i = robots.findIndex((r) => r.current === null);
    if (i >= 0) {
      const robot = robots[i]!;
      robots[i] = {
        ...robot,
        idleElapsed: 0,
        current: travelAnimation(
          repositionJob("security_gate"),
          routeFromHome(i, robot.restAt, "security_gate"),
        ),
      };
    }
  }
  if (!state.holdAtGate) {
    const i = robots.findIndex((r) => r.current === null && r.restAt === "security_gate");
    if (i >= 0) {
      const robot = robots[i]!;
      robots[i] = {
        ...robot,
        idleElapsed: 0,
        current: travelAnimation(
          repositionJob("command_core"),
          routeFromHome(i, robot.restAt, "command_core"),
        ),
      };
    }
  }

  // Ambient idling (D-030): each hub-parked robot runs its own staggered
  // idle clock and alternates a short pace with an in-place fidget. Never
  // while a gate wait is showing, never inside a department room, and
  // instantly preempted by real work above.
  for (let i = 0; i < robots.length; i++) {
    const robot = robots[i]!;
    if (robot.current !== null || robot.restAt !== "command_core" || state.holdAtGate) continue;
    const idleElapsed = robot.idleElapsed + dt;
    if (idleElapsed < AMBIENT_INTERVAL + i * AMBIENT_STAGGER) {
      robots[i] = { ...robot, idleElapsed };
    } else if (robot.fidgetNext) {
      robots[i] = { ...robot, idleElapsed: 0, fidgetNext: false, current: fidgetAnimation(i) };
    } else {
      robots[i] = {
        ...robot,
        idleElapsed: 0,
        fidgetNext: true,
        current: travelAnimation(ambientJob(i), AMBIENT_LINES[i]!),
      };
    }
  }

  return { ...state, robots, queue };
}

export interface RobotPlacement {
  position: Point;
  /** Y-rotation the robot faces (its front is +z). */
  heading: number;
  phase: AnimationPhase | "idle" | "gate" | "ambient" | "fidget";
  /** Normalized movement intensity (0 when stationary), for lean/sway. */
  speed: number;
  /**
   * True ground speed in world units per second. Lets the renderer roll
   * the wheel and step the gait by distance actually covered, so feet
   * never slide against the floor.
   */
  velocity: number;
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

function placementFor(state: AnimatorState, index: number): RobotPlacement {
  const none = {
    speed: 0,
    velocity: 0,
    activeDepartment: null as Department | null,
    outcome: null as JobOutcome | null,
    carrying: null as Department | null,
  };
  const robot = state.robots[index]!;
  const { current } = robot;

  if (current !== null) {
    if (current.phase === "travel" || current.phase === "return") {
      const t = Math.min(current.elapsed / current.duration, 1);
      const eased = easeInOut(t);
      const { position, heading } = pointAlongRoute(current.route, eased * current.length);
      const speed = Math.max(0, 6 * t * (1 - t)); // smoothstep derivative shape
      // Exact d(easeInOut)/dt, so velocity integrates back to route length.
      const easeRate = t < 0.5 ? 4 * t : 4 - 4 * t;
      const velocity = current.duration > 0 ? (easeRate * current.length) / current.duration : 0;
      const ambient = current.job.kind === "ambient";
      return {
        ...none,
        position,
        heading,
        speed: Math.min(speed, 1.4),
        velocity,
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
        const pauseAt = current.route[current.route.length - 1]!;
        return { ...none, position: pauseAt, heading: 0, phase: "ambient" };
      }
      if (current.job.kind === "fidget") {
        return { ...none, position: current.route[0]!, heading: 0, phase: "fidget" };
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

  if (state.holdAtGate && robot.restAt === "security_gate") {
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
    position: homePoint(index, robot.restAt),
    heading: robot.restAt === "command_core" ? 0 : stationHeading(robot.restAt),
    phase: "idle",
  };
}

/** Placements for the whole fleet, index-aligned with the robots array. */
export function robotPlacements(state: AnimatorState): RobotPlacement[] {
  return state.robots.map((_, index) => placementFor(state, index));
}

/** Routes to highlight on the floor while task robots are travelling. */
export function activeRoutes(state: AnimatorState): Point[][] {
  return state.robots
    .map((robot) => robot.current)
    .filter(
      (current): current is CurrentAnimation =>
        current !== null && current.job.kind === "task" && current.phase === "travel",
    )
    .map((current) => current.route);
}
