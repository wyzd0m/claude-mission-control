import { describe, expect, it } from "vitest";
import {
  archiveProject,
  changeProjectStage,
  createProject,
  projectSchema,
  restoreProject,
  updateProjectDetails,
} from "./project.js";
import type { DomainDeps } from "./common.js";

const deps: DomainDeps = {
  now: () => new Date("2026-07-05T12:00:00.000Z"),
  newId: () => "project-1",
};

describe("createProject", () => {
  it("creates a valid active project with defaults", () => {
    const project = createProject({ name: "Demo" }, deps);
    expect(projectSchema.parse(project)).toEqual(project);
    expect(project).toMatchObject({
      id: "project-1",
      name: "Demo",
      description: "",
      goal: "",
      definitionOfDone: "",
      currentStage: "discovery",
      status: "active",
      revision: 1,
      createdAt: "2026-07-05T12:00:00.000Z",
    });
  });

  it("rejects an empty name", () => {
    expect(() => createProject({ name: "   " }, deps)).toThrow();
  });

  it("rejects an oversized name", () => {
    expect(() => createProject({ name: "x".repeat(121) }, deps)).toThrow();
  });
});

describe("updateProjectDetails", () => {
  it("applies changes, bumps revision, and does not mutate the original", () => {
    const original = createProject({ name: "Demo" }, deps);
    const updated = updateProjectDetails(original, { goal: "Ship v1" }, deps);
    expect(updated.goal).toBe("Ship v1");
    expect(updated.revision).toBe(2);
    expect(original.goal).toBe("");
    expect(original.revision).toBe(1);
  });
});

describe("changeProjectStage", () => {
  it("changes the stage explicitly", () => {
    const project = createProject({ name: "Demo" }, deps);
    const moved = changeProjectStage(project, "building", deps);
    expect(moved.currentStage).toBe("building");
    expect(moved.revision).toBe(2);
  });

  it("rejects unknown stages", () => {
    const project = createProject({ name: "Demo" }, deps);
    // @ts-expect-error deliberately invalid
    expect(() => changeProjectStage(project, "deployed", deps)).toThrow(/Unknown project stage/);
  });
});

describe("archive and restore", () => {
  it("round-trips project status", () => {
    const project = createProject({ name: "Demo" }, deps);
    const archived = archiveProject(project, deps);
    expect(archived.status).toBe("archived");
    const restored = restoreProject(archived, deps);
    expect(restored.status).toBe("active");
    expect(restored.revision).toBe(3);
  });
});
