import { describe, expect, it } from "vitest";
import { createProject } from "./project.js";
import { createTask } from "./task.js";
import { createDecision } from "./decision.js";
import { createArtifact } from "./artifact.js";
import { createCheckpoint } from "./checkpoint.js";
import { EXPORT_FORMAT_VERSION, validateProjectExport, type ProjectExport } from "./export.js";
import { DomainError } from "./errors.js";
import type { DomainDeps } from "./common.js";

let counter = 0;
const deps: DomainDeps = {
  now: () => new Date("2026-07-05T12:00:00.000Z"),
  newId: () => `id-${++counter}`,
};

function buildExport(): ProjectExport {
  const project = createProject({ name: "Demo" }, deps);
  const task = createTask({ projectId: project.id, title: "Build login screen" }, deps);
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: "2026-07-05T12:00:00.000Z",
    project,
    tasks: [task],
    decisions: [
      createDecision(
        {
          projectId: project.id,
          summary: "A decision",
          rationale: "why",
          relatedTaskIds: [task.id],
        },
        deps,
      ),
    ],
    artifacts: [
      createArtifact(
        {
          projectId: project.id,
          name: "a.ts",
          pathOrReference: "src/a.ts",
          relatedTaskIds: [task.id],
        },
        deps,
      ),
    ],
    checkpoints: [createCheckpoint({ projectId: project.id, summary: "cp" }, deps)],
  };
}

describe("validateProjectExport", () => {
  it("accepts a well-formed bundle and round-trips through JSON", () => {
    const bundle = buildExport();
    const revived = validateProjectExport(JSON.parse(JSON.stringify(bundle)));
    expect(revived).toEqual(bundle);
  });

  it("rejects unknown format versions", () => {
    const bundle = { ...buildExport(), formatVersion: 999 };
    expect(() => validateProjectExport(bundle)).toThrow(DomainError);
  });

  it("rejects records that belong to a different project", () => {
    const bundle = buildExport();
    bundle.tasks[0] = { ...bundle.tasks[0]!, projectId: "someone-else" };
    expect(() => validateProjectExport(JSON.parse(JSON.stringify(bundle)))).toThrow(
      /different project/,
    );
  });

  it("rejects dangling parent-task references", () => {
    const bundle = buildExport();
    bundle.tasks[0] = { ...bundle.tasks[0]!, parentTaskId: "missing-task" };
    expect(() => validateProjectExport(JSON.parse(JSON.stringify(bundle)))).toThrow(/parent task/);
  });

  it("rejects dangling related-task references", () => {
    const bundle = buildExport();
    bundle.decisions[0] = { ...bundle.decisions[0]!, relatedTaskIds: ["missing-task"] };
    expect(() => validateProjectExport(JSON.parse(JSON.stringify(bundle)))).toThrow(
      /not in the export/,
    );
  });

  it("rejects structurally invalid payloads with a helpful location", () => {
    try {
      validateProjectExport({ formatVersion: EXPORT_FORMAT_VERSION });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("IMPORT_INVALID");
    }
  });
});
