// Identity data tests (D-029): the fleet roster stays index-aligned with the
// animator's robot list and every robot is visually distinguishable.
import { describe, expect, it } from "vitest";
import { ROBOT_IDENTITIES } from "./robot-identities.js";
import { ROBOT_HOME_POINTS } from "./layout.js";

describe("robot identities", () => {
  it("has exactly one identity per fleet home point", () => {
    expect(ROBOT_IDENTITIES).toHaveLength(ROBOT_HOME_POINTS.length);
  });

  it("gives every robot a unique name, variant, and accent", () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(ROBOT_IDENTITIES.map((r) => r.name))).toBe(true);
    expect(unique(ROBOT_IDENTITIES.map((r) => r.variant))).toBe(true);
    expect(unique(ROBOT_IDENTITIES.map((r) => r.accent))).toBe(true);
  });

  it("keeps scales in a range that fits doors and stations", () => {
    for (const identity of ROBOT_IDENTITIES) {
      expect(identity.scale).toBeGreaterThanOrEqual(0.8);
      expect(identity.scale).toBeLessThanOrEqual(1.3);
    }
  });
});
