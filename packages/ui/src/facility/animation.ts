import type { DashboardState, Department, EventStatus } from "@mission-control/domain";
import { ROOM_POSITIONS } from "./layout.js";

// Pure presentation state machine for Phase 7 (docs/IMPLEMENTATION_ROADMAP.md).
// It animates only persisted Mission Control events observed through the
// dashboard read model:
//   - a newly observed event becomes one replay job:
//     travel -> working -> outcome -> (return when the queue is empty)
//   - an event that is still open loops in `working` until a later poll
//     shows its terminal status; the outcome then plays truthfully
//   - open waiting_for_input events hold the robot at the Security Gate
//   - the very first ingest marks history as seen WITHOUT animating, so a
//     reload restores the correct quiet state instead of replaying the past
// The animator is a pure reducer so every rule is unit-testable
// (docs/TESTING_STRATEGY.md "3D state tests").

export type JobOutcome = "succeeded" | "failed" | "cancelled" | "open";
export type AnimationPhase = "travel" | "working" | "outcome" | "return";

export interface AnimationJob {
  eventId: string;
  department: Department;
  outcome: JobOutcome;
}

export interface CurrentAnimation {
  job: AnimationJob;
  phase: AnimationPhase;
  /** Department the robot is coming from in the current phase. */
  from: Department;
  elapsed: number;
}

export interface AnimatorState {
  initialized: boolean;
  /** Last observed status per event id. */
  seen: Record<string, EventStatus>;
  queue: AnimationJob[];
  current: CurrentAnimation | null;
  /** An open approval keeps the robot at the Security Gate when free. */
  holdAtGate: boolean;
}

export const PHASE_DURATIONS: Record<AnimationPhase, number> = {
  travel: 1.2,
  working: 1.6,
  outcome: 0.9,
  return: 1.2,
};

const MAX_QUEUE = 4;
const TERMINAL: readonly EventStatus[] = ["succeeded", "failed", "cancelled"];

export function createAnimator(): AnimatorState {
  return { initialized: false, seen: {}, queue: [], current: null, holdAtGate: false };
}

function outcomeOf(status: EventStatus): JobOutcome {
  return TERMINAL.includes(status) ? (status as JobOutcome) : "open";
}

/**
 * Observe the latest read model. Returns a new state with newly observed
 * events enqueued and outcomes of known events updated. Never mutates.
 */
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
    return { initialized: true, seen, queue: [], current: null, holdAtGate };
  }

  const newJobs: AnimationJob[] = [];
  // Timeline is newest first; replay in chronological order.
  for (const event of [...dashboard.timeline].reverse()) {
    if (!(event.id in seen)) {
      newJobs.push({
        eventId: event.id,
        department: event.department,
        outcome: outcomeOf(event.status),
      });
    }
    seen[event.id] = event.status;
  }
  for (const event of dashboard.currentActivity.openEvents) {
    if (!(event.id in seen) && event.status !== "waiting_for_input") {
      newJobs.push({ eventId: event.id, department: event.department, outcome: "open" });
    }
    seen[event.id] = event.status;
  }

  // Update outcomes of jobs already queued or playing.
  const updateJob = (job: AnimationJob): AnimationJob => {
    const status = seen[job.eventId];
    return status !== undefined && job.outcome === "open"
      ? { ...job, outcome: outcomeOf(status) }
      : job;
  };
  const queue = [...state.queue.map(updateJob), ...newJobs].slice(-MAX_QUEUE);
  const current = state.current ? { ...state.current, job: updateJob(state.current.job) } : null;

  return { initialized: true, seen, queue, current, holdAtGate };
}

/** Advance the animation clock. Pure: returns the next state. */
export function tick(state: AnimatorState, dt: number): AnimatorState {
  if (!state.initialized) return state;

  const { queue, current } = state;

  if (current === null) {
    const [next, ...rest] = queue;
    if (next === undefined) return state;
    return {
      ...state,
      queue: rest,
      current: { job: next, phase: "travel", from: "command_core", elapsed: 0 },
    };
  }

  const elapsed = current.elapsed + dt;
  const duration = PHASE_DURATIONS[current.phase];

  // An open job keeps working until its event completes — the loop reflects
  // a genuinely running operation, never invented progress.
  if (current.phase === "working" && current.job.outcome === "open") {
    return { ...state, current: { ...current, elapsed: Math.min(elapsed, duration) } };
  }

  if (elapsed < duration) {
    return { ...state, current: { ...current, elapsed } };
  }

  switch (current.phase) {
    case "travel":
      return { ...state, current: { ...current, phase: "working", elapsed: 0 } };
    case "working":
      return { ...state, current: { ...current, phase: "outcome", elapsed: 0 } };
    case "outcome": {
      const [next, ...rest] = queue;
      if (next !== undefined) {
        return {
          ...state,
          queue: rest,
          current: { job: next, phase: "travel", from: current.job.department, elapsed: 0 },
        };
      }
      return {
        ...state,
        current: {
          job: current.job,
          phase: "return",
          from: current.job.department,
          elapsed: 0,
        },
      };
    }
    case "return":
      return { ...state, current: null };
  }
}

export interface RobotPlacement {
  from: Department;
  to: Department;
  /** 0..1 progress between from and to; 1 while stationary. */
  t: number;
  phase: AnimationPhase | "idle" | "gate";
  /** Department whose room should show activity right now, if any. */
  activeDepartment: Department | null;
  outcome: JobOutcome | null;
}

export function robotPlacement(state: AnimatorState): RobotPlacement {
  const { current } = state;
  if (current !== null) {
    const duration = PHASE_DURATIONS[current.phase];
    const t = Math.min(current.elapsed / duration, 1);
    switch (current.phase) {
      case "travel":
        return {
          from: current.from,
          to: current.job.department,
          t,
          phase: "travel",
          activeDepartment: null,
          outcome: null,
        };
      case "working":
        return {
          from: current.job.department,
          to: current.job.department,
          t: 1,
          phase: "working",
          activeDepartment: current.job.department,
          outcome: null,
        };
      case "outcome":
        return {
          from: current.job.department,
          to: current.job.department,
          t: 1,
          phase: "outcome",
          activeDepartment: current.job.department,
          outcome: current.job.outcome,
        };
      case "return":
        return {
          from: current.from,
          to: "command_core",
          t,
          phase: "return",
          activeDepartment: null,
          outcome: null,
        };
    }
  }
  if (state.holdAtGate) {
    return {
      from: "security_gate",
      to: "security_gate",
      t: 1,
      phase: "gate",
      activeDepartment: "security_gate",
      outcome: null,
    };
  }
  return {
    from: "command_core",
    to: "command_core",
    t: 1,
    phase: "idle",
    activeDepartment: null,
    outcome: null,
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** World position for the robot, derived from a placement. */
export function robotWorldPosition(placement: RobotPlacement): [number, number] {
  const [fx, fz] = ROOM_POSITIONS[placement.from];
  const [tx, tz] = ROOM_POSITIONS[placement.to];
  const t = easeInOut(placement.t);
  return [fx + (tx - fx) * t, fz + (tz - fz) * t];
}
