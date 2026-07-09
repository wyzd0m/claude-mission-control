import type { Department } from "@mission-control/domain";

// Per-department work gestures (D-027). Pure motion profiles: given a
// gesture kind and a clock time, return bounded channel values that the
// renderer applies to the robot's arms and its held prop. Presentation
// only — a gesture plays exclusively while the animator's working/outcome
// phase presents a persisted event at that department, so no gesture can
// imply work that was not observed.

export type GestureKind =
  | "type" // command_core — typing at the dispatch console (no prop)
  | "place" // planning_bay — setting a task card down on the table
  | "read" // research_archive — leafing through a reference book
  | "tinker" // build_workshop — working a wrench
  | "scan" // testing_lab — sweeping a diagnostic probe
  | "file" // memory_vault — sliding a cartridge into the archive
  | "stamp" // security_gate — stamping a reviewed document
  | "pack"; // delivery_dock — hefting a package onto the platform

export const DEPARTMENT_GESTURES: Record<Department, GestureKind> = {
  command_core: "type",
  planning_bay: "place",
  research_archive: "read",
  build_workshop: "tinker",
  testing_lab: "scan",
  memory_vault: "file",
  security_gate: "stamp",
  delivery_dock: "pack",
};

export interface GestureFrame {
  /** Vertical arm bob in robot-local units (the typing motion). */
  armBob: number;
  /** Forward/back arm swing in radians. */
  armSwing: number;
  /** Prop translation from its held rest position, in robot-local units. */
  propOffset: [number, number, number];
  /** Prop pitch in radians. */
  propTilt: number;
  /** Extra body yaw in radians (turning to a shelf while organizing). */
  yaw?: number;
}

/** Neutral frame: prop held still (used while the outcome plays). */
export const GESTURE_REST: GestureFrame = {
  armBob: 0,
  armSwing: 0,
  propOffset: [0, 0, 0],
  propTilt: 0,
};

/** Smooth 0→1→0 cycle at `hz`, for repeated place/push motions. */
function cycle(t: number, hz: number): number {
  return (Math.sin(t * hz * Math.PI * 2) + 1) / 2;
}

/**
 * Busy-work variations layered into LONG-RUNNING work (D-031): once a robot
 * has been at a station a while, it alternates its primary gesture with
 * generic office chores. Purely presentational variety inside the truthful
 * `working` phase of a persisted event — never played while idle.
 */
export type BusyKind = "paperwork" | "organize";

export const BUSY_SEQUENCE: readonly (BusyKind | null)[] = [null, "paperwork", "organize"];

/** Seconds of primary gesture before busy-work variety begins. Shorter than
 *  the standard working beat so every room visit shows gesture + a chore. */
export const BUSY_LEAD_IN = 1.8;
/** Seconds each busy-work segment lasts before rotating. */
export const BUSY_SEGMENT = 1.6;

/** Which busy-work (or null = primary gesture) plays after `workSeconds`. */
export function busyKindAt(workSeconds: number): BusyKind | null {
  if (workSeconds < BUSY_LEAD_IN) return null;
  const index = Math.floor((workSeconds - BUSY_LEAD_IN) / BUSY_SEGMENT) % BUSY_SEQUENCE.length;
  return BUSY_SEQUENCE[(index + 1) % BUSY_SEQUENCE.length]!;
}

/** Motion channels for a busy-work chore at clock time `t`. Deterministic. */
export function busyFrame(kind: BusyKind, t: number): GestureFrame {
  switch (kind) {
    case "paperwork": {
      // Clipboard held up, pen-tick wiggles while filling out a form.
      return {
        armBob: Math.sin(t * 5.5) * 0.02,
        armSwing: 0.15,
        propOffset: [0.04 * Math.sin(t * 5.5), 0.06, 0.02],
        propTilt: 0.5,
      };
    }
    case "organize": {
      // Turning side to side, moving a folder between stacks.
      const c = cycle(t, 0.55);
      return {
        armBob: 0,
        armSwing: 0.12 * c,
        propOffset: [0.16 * (2 * c - 1), 0.05 * c, 0.02],
        propTilt: 0.1,
        yaw: 0.45 * (2 * c - 1),
      };
    }
  }
}

/** Motion channels for a gesture at clock time `t` (seconds). Deterministic. */
export function gestureFrame(kind: GestureKind, t: number): GestureFrame {
  switch (kind) {
    case "type":
      return { ...GESTURE_REST, armBob: Math.sin(t * 7) * 0.035 };
    case "place": {
      const c = cycle(t, 0.7);
      return {
        armBob: 0,
        armSwing: 0.22 * c,
        propOffset: [0, -0.13 * c, 0.16 * c],
        propTilt: -0.3 * c,
      };
    }
    case "read":
      return {
        armBob: Math.sin(t * 2.2) * 0.012,
        armSwing: 0,
        propOffset: [0, 0.02 * Math.sin(t * 1.3), 0],
        propTilt: 0.12 * Math.sin(t * 2.2),
      };
    case "tinker": {
      const s = Math.sin(t * 9);
      return { armBob: 0, armSwing: 0.2 * s, propOffset: [0, 0.05 * s, 0], propTilt: 0.32 * s };
    }
    case "scan":
      return {
        armBob: 0,
        armSwing: 0,
        propOffset: [0.14 * Math.sin(t * 2.6), 0, 0],
        propTilt: 0.15 * Math.cos(t * 2.6),
      };
    case "file": {
      const c = cycle(t, 0.55);
      return { armBob: 0, armSwing: 0.18 * c, propOffset: [0, 0.05 * c, 0.2 * c], propTilt: 0 };
    }
    case "stamp": {
      const lift = Math.max(0, Math.sin(t * 5));
      return { armBob: 0, armSwing: -0.12 * lift, propOffset: [0, 0.15 * lift, 0], propTilt: 0 };
    }
    case "pack": {
      const c = cycle(t, 0.5);
      return {
        armBob: 0,
        armSwing: 0.15 * c,
        propOffset: [0, 0.12 * c, 0.05 * (1 - c)],
        propTilt: 0.08 * Math.sin(t * Math.PI),
      };
    }
  }
}
