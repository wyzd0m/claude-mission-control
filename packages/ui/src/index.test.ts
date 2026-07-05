import { describe, expect, it } from "vitest";
import { PROJECT_STAGES } from "@mission-control/domain";
import { STAGE_LABELS } from "./index.js";

describe("stage labels", () => {
  it("provides a label for every domain stage", () => {
    for (const stage of PROJECT_STAGES) {
      expect(STAGE_LABELS[stage]).toBeTruthy();
    }
  });
});
