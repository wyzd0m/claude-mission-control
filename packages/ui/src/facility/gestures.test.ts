// Gesture profile tests (D-027): every department has its own bounded,
// deterministic work motion, so the renderer can never produce wild or
// non-repeatable movement from a persisted event.
import { describe, expect, it } from "vitest";
import { DEPARTMENT_GESTURES, GESTURE_REST, gestureFrame } from "./gestures.js";

const KINDS = [...new Set(Object.values(DEPARTMENT_GESTURES))];

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
