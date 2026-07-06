import { describe, expect, it } from "vitest";
import { createTask, updateTask } from "./task.js";
import { DomainError } from "./errors.js";
import type { DomainDeps } from "./common.js";

let counter = 0;
const deps: DomainDeps = {
  now: () => new Date("2026-07-05T12:00:00.000Z"),
  newId: () => `task-${++counter}`,
};

function newTask() {
  return createTask({ projectId: "project-1", title: "Build login screen" }, deps);
}

describe("createTask", () => {
  it("creates a todo task with defaults", () => {
    const task = newTask();
    expect(task).toMatchObject({
      projectId: "project-1",
      title: "Build login screen",
      status: "todo",
      priority: "medium",
      stage: "planning",
      blockedReason: null,
      parentTaskId: null,
      completedAt: null,
      revision: 1,
    });
  });
});

describe("task status rules", () => {
  it("requires a reason to block", () => {
    const task = newTask();
    expect(() => updateTask(task, { status: "blocked" }, deps)).toThrow(DomainError);
    expect(() => updateTask(task, { status: "blocked", blockedReason: "  " }, deps)).toThrow(
      /blocked reason/,
    );
  });

  it("stores the reason while blocked and clears it on unblock", () => {
    const task = newTask();
    const blocked = updateTask(
      task,
      { status: "blocked", blockedReason: "Waiting on API keys" },
      deps,
    );
    expect(blocked.blockedReason).toBe("Waiting on API keys");
    const resumed = updateTask(blocked, { status: "in_progress" }, deps);
    expect(resumed.blockedReason).toBeNull();
  });

  it("stamps completedAt on done and clears it on reopen", () => {
    const task = newTask();
    const done = updateTask(task, { status: "done" }, deps);
    expect(done.completedAt).toBe("2026-07-05T12:00:00.000Z");
    const reopened = updateTask(done, { status: "todo" }, deps);
    expect(reopened.completedAt).toBeNull();
  });

  it("keeps the original completedAt when a done task is edited", () => {
    const task = newTask();
    const done = updateTask(
      task,
      { status: "done" },
      {
        ...deps,
        now: () => new Date("2026-07-05T13:00:00.000Z"),
      },
    );
    const renamed = updateTask(
      done,
      { title: "Build login page" },
      {
        ...deps,
        now: () => new Date("2026-07-05T14:00:00.000Z"),
      },
    );
    expect(renamed.completedAt).toBe("2026-07-05T13:00:00.000Z");
  });

  it("rejects self-parenting", () => {
    const task = newTask();
    expect(() => updateTask(task, { parentTaskId: task.id }, deps)).toThrow(/own parent/);
  });

  it("bumps revision on every update", () => {
    const task = newTask();
    const updated = updateTask(task, { priority: "high" }, deps);
    expect(updated.revision).toBe(2);
    expect(task.revision).toBe(1);
  });
});
