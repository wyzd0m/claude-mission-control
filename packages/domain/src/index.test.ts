import { describe, expect, it } from "vitest";
import { isProjectStage, PROJECT_STAGES } from "./index.js";

describe("project stages", () => {
  it("defines the seven explicit stages in order", () => {
    expect(PROJECT_STAGES).toEqual([
      "discovery",
      "planning",
      "building",
      "testing",
      "reviewing",
      "shipping",
      "maintenance",
    ]);
  });

  it("recognizes valid stages", () => {
    for (const stage of PROJECT_STAGES) {
      expect(isProjectStage(stage)).toBe(true);
    }
  });

  it("rejects invalid values", () => {
    expect(isProjectStage("deployed")).toBe(false);
    expect(isProjectStage("")).toBe(false);
    expect(isProjectStage(null)).toBe(false);
    expect(isProjectStage(42)).toBe(false);
  });
});
