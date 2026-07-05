import { describe, expect, it } from "vitest";
import { describeWiring } from "./index.js";

describe("workspace wiring", () => {
  it("resolves the domain package across the workspace boundary", () => {
    expect(describeWiring()).toBe("@mission-control/server -> @mission-control/domain");
  });
});
