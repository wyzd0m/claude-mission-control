import { describe, expect, it } from "vitest";
import { createDecision } from "./decision.js";
import { createArtifact, setArtifactVerification } from "./artifact.js";
import { createCheckpoint } from "./checkpoint.js";
import { DomainError } from "./errors.js";
import type { DomainDeps } from "./common.js";

let counter = 0;
const deps: DomainDeps = {
  now: () => new Date("2026-07-05T12:00:00.000Z"),
  newId: () => `record-${++counter}`,
};

describe("decisions", () => {
  it("stores rationale and alternatives", () => {
    const decision = createDecision(
      {
        projectId: "project-1",
        summary: "Use node:sqlite",
        rationale: "No native dependencies to package.",
        alternativesConsidered: ["better-sqlite3", "sql.js"],
      },
      deps,
    );
    expect(decision.rationale).toContain("native");
    expect(decision.alternativesConsidered).toHaveLength(2);
  });
});

describe("artifact verification", () => {
  it("starts unverified and requires a note to verify", () => {
    const artifact = createArtifact(
      { projectId: "project-1", name: "login.ts", pathOrReference: "src/login.ts" },
      deps,
    );
    expect(artifact.verificationStatus).toBe("unverified");
    expect(() => setArtifactVerification(artifact, "verified", "  ", deps)).toThrow(DomainError);

    const verified = setArtifactVerification(artifact, "verified", "Unit tests passed", deps);
    expect(verified.verificationStatus).toBe("verified");
    expect(verified.verificationNote).toBe("Unit tests passed");
    expect(verified.verifiedAt).not.toBeNull();
  });

  it("records failed verification with the validation performed", () => {
    const artifact = createArtifact(
      { projectId: "project-1", name: "login.ts", pathOrReference: "src/login.ts" },
      deps,
    );
    const failed = setArtifactVerification(artifact, "failed", "Type check failed", deps);
    expect(failed.verificationStatus).toBe("failed");
  });
});

describe("checkpoints", () => {
  it("captures the structured handoff fields", () => {
    const checkpoint = createCheckpoint(
      {
        projectId: "project-1",
        summary: "End of phase 2",
        completedWork: ["Domain model"],
        openWork: ["MCP tools"],
        decisions: ["node:sqlite chosen"],
        blockers: [],
        recommendedNextAction: "Start phase 3",
      },
      deps,
    );
    expect(checkpoint.completedWork).toEqual(["Domain model"]);
    expect(checkpoint.recommendedNextAction).toBe("Start phase 3");
  });
});
