// Gesture profile tests (D-027): every department has its own bounded,
// deterministic work motion, so the renderer can never produce wild or
// non-repeatable movement from a persisted event.
import { describe, expect, it } from "vitest";
import {
  BUSY_LEAD_IN,
  BUSY_SEGMENT,
  busyFrame,
  busyKindAt,
  DEPARTMENT_GESTURES,
  GESTURE_REST,
  gestureFrame,
  type BusyKind,
} from "./gestures.js";

const KINDS = [...new Set(Object.values(DEPARTMENT_GESTURES))];
const BUSY_KINDS: BusyKind[] = ["paperwork", "organize"];

describe("department gestures", () => {
  it("gives each of the eight departments its own gesture", () => {
    expect(Object.keys(DEPARTMENT_GESTURES)).toHaveLength(8);
    expect(KINDS).toHaveLength(8);
  });

  it("is deterministic for a given time", () => {
    for (const kind of KINDS) {
      expect(gestureFrame(kind, 1.37)).toEqual(gestureFrame(kind, 1.37));
    }
  });

  it("keeps every channel finite and within calm bounds", () => {
    for (const kind of KINDS) {
      for (let t = 0; t < 20; t += 0.05) {
        const frame = gestureFrame(kind, t);
        expect(Math.abs(frame.armBob)).toBeLessThanOrEqual(0.06);
        expect(Math.abs(frame.armSwing)).toBeLessThanOrEqual(0.45);
        for (const axis of frame.propOffset) {
          expect(Number.isFinite(axis)).toBe(true);
          expect(Math.abs(axis)).toBeLessThanOrEqual(0.3);
        }
        expect(Math.abs(frame.propTilt)).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("holds the prop still in the rest frame", () => {
    expect(GESTURE_REST.propOffset).toEqual([0, 0, 0]);
    expect(GESTURE_REST.armSwing).toBe(0);
  });

  it("actually moves: no gesture is a static pose", () => {
    for (const kind of KINDS) {
      let travel = 0;
      let previous = gestureFrame(kind, 0);
      for (let t = 0.05; t < 4; t += 0.05) {
        const frame = gestureFrame(kind, t);
        travel +=
          Math.abs(frame.armBob - previous.armBob) +
          Math.abs(frame.armSwing - previous.armSwing) +
          Math.abs(frame.propTilt - previous.propTilt) +
          frame.propOffset.reduce(
            (sum, axis, i) => sum + Math.abs(axis - previous.propOffset[i]!),
            0,
          );
        previous = frame;
      }
      expect(travel).toBeGreaterThan(0.1);
    }
  });
});

describe("busy-work variations", () => {
  it("plays only the primary gesture at first, then rotates the chores", () => {
    expect(busyKindAt(0)).toBeNull();
    expect(busyKindAt(BUSY_LEAD_IN - 0.1)).toBeNull();
    const seen = new Set<string>();
    for (let t = BUSY_LEAD_IN; t < BUSY_LEAD_IN + BUSY_SEGMENT * 6; t += 0.5) {
      seen.add(String(busyKindAt(t)));
    }
    expect(seen).toEqual(new Set(["paperwork", "organize", "null"]));
  });

  it("keeps chore channels bounded, deterministic, and moving", () => {
    for (const kind of BUSY_KINDS) {
      expect(busyFrame(kind, 2.4)).toEqual(busyFrame(kind, 2.4));
      let travel = 0;
      let previous = busyFrame(kind, 0);
      for (let t = 0.05; t < 8; t += 0.05) {
        const frame = busyFrame(kind, t);
        expect(Math.abs(frame.armBob)).toBeLessThanOrEqual(0.06);
        expect(Math.abs(frame.armSwing)).toBeLessThanOrEqual(0.45);
        expect(Math.abs(frame.propTilt)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(frame.yaw ?? 0)).toBeLessThanOrEqual(0.5);
        for (const axis of frame.propOffset) {
          expect(Number.isFinite(axis)).toBe(true);
          expect(Math.abs(axis)).toBeLessThanOrEqual(0.3);
        }
        travel +=
          Math.abs((frame.yaw ?? 0) - (previous.yaw ?? 0)) +
          Math.abs(frame.armBob - previous.armBob);
        previous = frame;
      }
      expect(travel).toBeGreaterThan(0.1);
    }
  });
});
