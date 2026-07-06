import { describe, expect, it } from "vitest";
import { createActivityEvent, reportEventProgress, transitionEvent } from "./activity-event.js";
import { DomainError } from "./errors.js";
import type { DomainDeps } from "./common.js";

let counter = 0;
const deps: DomainDeps = {
  now: () => new Date("2026-07-05T12:00:00.000Z"),
  newId: () => `event-${++counter}`,
};

function newEvent() {
  return createActivityEvent(
    { toolName: "create_task", displayLabel: "Creating task", department: "planning_bay" },
    deps,
  );
}

describe("createActivityEvent", () => {
  it("starts queued with no progress and no result claims", () => {
    const event = newEvent();
    expect(event).toMatchObject({
      status: "queued",
      requiresInput: false,
      progressCurrent: null,
      progressTotal: null,
      completedAt: null,
      resultSummary: null,
      errorCode: null,
      errorSummary: null,
    });
    expect(event.correlationId).toBeTruthy();
  });
});

describe("event state machine", () => {
  it("follows the canonical happy path", () => {
    let event = newEvent();
    event = transitionEvent(event, "travelling", {}, deps);
    event = transitionEvent(event, "working", {}, deps);
    event = transitionEvent(event, "succeeded", { resultSummary: "Task created" }, deps);
    expect(event.status).toBe("succeeded");
    expect(event.resultSummary).toBe("Task created");
    expect(event.completedAt).toBe("2026-07-05T12:00:00.000Z");
  });

  it("supports the approval waiting loop", () => {
    let event = newEvent();
    event = transitionEvent(event, "working", {}, deps);
    event = transitionEvent(event, "waiting_for_input", {}, deps);
    expect(event.requiresInput).toBe(true);
    event = transitionEvent(event, "working", {}, deps);
    expect(event.requiresInput).toBe(false);
  });

  it("rejects illegal transitions", () => {
    const event = newEvent();
    expect(() => transitionEvent(event, "waiting_for_input", {}, deps)).toThrow(DomainError);
  });

  it("keeps terminal events immutable", () => {
    let event = newEvent();
    event = transitionEvent(event, "working", {}, deps);
    event = transitionEvent(event, "cancelled", {}, deps);
    try {
      transitionEvent(event, "working", {}, deps);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).message).toMatch(/cannot move from cancelled/);
      expect((error as DomainError).recovery).toMatch(/Terminal events are immutable/);
    }
  });

  it("requires an error code and summary on failure", () => {
    const event = newEvent();
    expect(() => transitionEvent(event, "failed", {}, deps)).toThrow(/errorCode/);
    const failed = transitionEvent(
      event,
      "failed",
      { errorCode: "PROJECT_NOT_FOUND", errorSummary: "The selected project no longer exists." },
      deps,
    );
    expect(failed.errorCode).toBe("PROJECT_NOT_FOUND");
    expect(failed.completedAt).not.toBeNull();
  });

  it("distinguishes cancellation from success and failure", () => {
    let event = newEvent();
    event = transitionEvent(event, "working", {}, deps);
    const cancelled = transitionEvent(event, "cancelled", {}, deps);
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.resultSummary).toBeNull();
    expect(cancelled.errorCode).toBeNull();
  });
});

describe("explicit progress", () => {
  it("stores explicit progress only", () => {
    let event = newEvent();
    event = transitionEvent(event, "working", {}, deps);
    event = reportEventProgress(
      event,
      { current: 3, total: 12, message: "retrieving decisions" },
      deps,
    );
    expect(event.progressCurrent).toBe(3);
    expect(event.progressTotal).toBe(12);
  });

  it("rejects invented or invalid progress", () => {
    let event = newEvent();
    event = transitionEvent(event, "working", {}, deps);
    expect(() => reportEventProgress(event, { current: 13, total: 12 }, deps)).toThrow(DomainError);
    expect(() => reportEventProgress(event, { current: -1, total: 12 }, deps)).toThrow(DomainError);
    expect(() => reportEventProgress(event, { current: 1, total: 0 }, deps)).toThrow(DomainError);
  });

  it("rejects progress on completed events", () => {
    let event = newEvent();
    event = transitionEvent(event, "working", {}, deps);
    event = transitionEvent(event, "succeeded", {}, deps);
    expect(() => reportEventProgress(event, { current: 1, total: 2 }, deps)).toThrow(DomainError);
  });
});
