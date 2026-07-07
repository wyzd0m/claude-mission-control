// Observability tests (docs/TESTING_STRATEGY.md "Observability tests"):
// every tool call must leave exactly one accurate persisted event, failures
// must become failed events with the same stable code, unknown progress must
// stay unknown, previews must wait at the Security Gate, and the idle state
// must claim nothing beyond "no observable activity".
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DEPARTMENTS, createActivityEvent } from "@mission-control/domain";
import { openDatabase } from "../storage/database.js";
import { createServiceContext, type ServiceContext } from "../services/service-context.js";
import {
  createActivityEventService,
  IDLE_MESSAGE,
  type ActivityEventService,
} from "../services/activity-event-service.js";
import { createMissionControlServer } from "./server.js";

interface Harness {
  client: Client;
  ctx: ServiceContext;
  activity: ActivityEventService;
  clock: { time: number };
  close: () => Promise<void>;
}

let tmpDataDir: string;
let harnesses: Harness[];

async function setup(options?: { approvalTtlMs?: number }): Promise<Harness> {
  const clock = { time: new Date("2026-07-05T12:00:00.000Z").getTime() };
  const { db } = openDatabase(":memory:");
  const ctx = createServiceContext(db, {
    now: () => new Date(clock.time),
    ...(options?.approvalTtlMs !== undefined ? { approvalTtlMs: options.approvalTtlMs } : {}),
  });
  const activity = createActivityEventService(ctx);
  const server = createMissionControlServer(ctx, { activity });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "phase4-tests", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const harness: Harness = {
    client,
    ctx,
    activity,
    clock,
    close: async () => {
      await client.close();
      db.close();
    },
  };
  harnesses.push(harness);
  return harness;
}

async function call(harness: Harness, name: string, args: Record<string, unknown> = {}) {
  const result = (await harness.client.callTool({ name, arguments: args })) as CallToolResult;
  return { result, data: result.structuredContent as Record<string, unknown> };
}

beforeEach(() => {
  tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmc-obs-test-"));
  process.env.CMC_DATA_DIR = tmpDataDir;
  harnesses = [];
});

afterEach(async () => {
  for (const harness of harnesses) {
    await harness.close();
  }
  delete process.env.CMC_DATA_DIR;
  fs.rmSync(tmpDataDir, { recursive: true, force: true });
});

describe("event lifecycle per tool call", () => {
  it("records exactly one accurate succeeded event per successful call", async () => {
    const harness = await setup();
    const created = await call(harness, "create_project", { name: "Demo" });

    const timeline = harness.activity.getTimeline();
    expect(timeline).toHaveLength(1);
    const event = timeline[0]!;
    expect(event.toolName).toBe("create_project");
    expect(event.displayLabel).toBe("Creating a project");
    expect(event.department).toBe("planning_bay");
    expect(event.status).toBe("succeeded");
    expect(event.completedAt).not.toBeNull();
    expect(event.resultSummary).toMatch(/Created project "Demo"/);
    // Late-bound project id from the created record.
    expect(event.projectId).toBe((created.data.project as { id: string }).id);
    // The tool result references the same event.
    const activityRef = created.data.activity as { eventId: string; correlationId: string };
    expect(activityRef.eventId).toBe(event.id);
    expect(activityRef.correlationId).toBe(event.correlationId);
  });

  it("records failed events with the same stable code the tool returned", async () => {
    const harness = await setup();
    const { result, data } = await call(harness, "get_project_brief", { projectId: "missing" });
    expect(result.isError).toBe(true);

    const timeline = harness.activity.getTimeline();
    expect(timeline).toHaveLength(1);
    const event = timeline[0]!;
    expect(event.status).toBe("failed");
    expect(event.errorCode).toBe("PROJECT_NOT_FOUND");
    expect(event.errorSummary).toMatch(/no longer exists/);
    expect(event.resultSummary).toBeNull();
    // Correlation id flows into the error result.
    const error = data.error as { correlationId?: string };
    expect(error.correlationId).toBe(event.correlationId);
  });

  it("keeps unknown progress unknown on every event", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    await call(harness, "create_task", { title: "T1" });
    await call(harness, "list_tasks");
    for (const event of harness.activity.getTimeline()) {
      expect(event.progressCurrent).toBeNull();
      expect(event.progressTotal).toBeNull();
      expect(event.progressMessage).toBeNull();
    }
  });

  it("relates task events to their tasks", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    const created = await call(harness, "create_task", { title: "T1" });
    const taskId = (created.data.task as { id: string }).id;
    await call(harness, "update_task", { taskId, priority: "high" });

    const updateEvent = harness.activity.getTimeline()[0]!;
    expect(updateEvent.toolName).toBe("update_task");
    expect(updateEvent.relatedTaskIds).toEqual([taskId]);
  });

  it("declares a valid department on every registered tool", async () => {
    const harness = await setup();
    const { tools } = await harness.client.listTools();
    expect(tools.length).toBe(24);
    for (const tool of tools) {
      const department = (tool._meta as { missionControl?: { department?: string } } | undefined)
        ?.missionControl?.department;
      expect(DEPARTMENTS as readonly string[], tool.name).toContain(department);
    }
  });
});

describe("honest idle state", () => {
  it("reports idle with the required language when nothing is open", async () => {
    const harness = await setup();
    const before = harness.activity.getCurrentActivity();
    expect(before.idle).toBe(true);
    expect(before.idleMessage).toBe(IDLE_MESSAGE);
    expect(before.openEvents).toHaveLength(0);

    // Synchronous operations complete within the call: idle again afterwards.
    await call(harness, "create_project", { name: "Demo" });
    const after = harness.activity.getCurrentActivity();
    expect(after.idle).toBe(true);
    expect(after.openEvents).toHaveLength(0);
  });
});

describe("approval waiting state", () => {
  async function seedPreview(harness: Harness) {
    await call(harness, "create_project", { name: "Demo" });
    await call(harness, "create_task", { title: "A" });
    const preview = await call(harness, "preview_bulk_task_update", {
      filterStatus: "todo",
      status: "in_progress",
    });
    return preview.data.preview as {
      affected: Array<{ id: string; revision: number }>;
      confirmationToken: string;
    };
  }

  it("keeps a Security Gate event waiting while approval is pending", async () => {
    const harness = await setup();
    await seedPreview(harness);

    const current = harness.activity.getCurrentActivity();
    expect(current.idle).toBe(false);
    expect(current.openEvents).toHaveLength(1);
    const waiting = current.openEvents[0]!;
    expect(waiting.status).toBe("waiting_for_input");
    expect(waiting.requiresInput).toBe(true);
    expect(waiting.department).toBe("security_gate");
    expect(waiting.displayLabel).toBe("Awaiting approval: bulk task update");
    // The preview tool call itself succeeded — the preview is not completed work.
    const previewEvent = harness.activity
      .getTimeline()
      .find((e) => e.toolName === "preview_bulk_task_update" && e.status === "succeeded");
    expect(previewEvent).toBeDefined();
  });

  it("resolves the waiting event as succeeded when the change is applied", async () => {
    const harness = await setup();
    const preview = await seedPreview(harness);
    await call(harness, "apply_bulk_task_update", {
      filterStatus: "todo",
      status: "in_progress",
      affected: preview.affected,
      confirmationToken: preview.confirmationToken,
    });

    expect(harness.activity.getCurrentActivity().idle).toBe(true);
    const gate = harness.activity
      .getTimeline()
      .find((e) => e.displayLabel === "Awaiting approval: bulk task update");
    expect(gate?.status).toBe("succeeded");
    expect(gate?.resultSummary).toBe("Approved and applied.");
  });

  it("fails the waiting event when the approved change conflicts", async () => {
    const harness = await setup();
    const preview = await seedPreview(harness);
    await call(harness, "update_task", { taskId: preview.affected[0]!.id, priority: "high" });
    const { result } = await call(harness, "apply_bulk_task_update", {
      filterStatus: "todo",
      status: "in_progress",
      affected: preview.affected,
      confirmationToken: preview.confirmationToken,
    });
    expect(result.isError).toBe(true);

    const gate = harness.activity
      .getTimeline()
      .find((e) => e.displayLabel === "Awaiting approval: bulk task update");
    expect(gate?.status).toBe("failed");
    expect(gate?.errorCode).toBe("REVISION_CONFLICT");
  });

  it("cancels the waiting event when the approval expires", async () => {
    const harness = await setup({ approvalTtlMs: 1000 });
    await seedPreview(harness);
    harness.clock.time += 2000;

    const current = harness.activity.getCurrentActivity();
    expect(current.idle).toBe(true);
    const gate = harness.activity
      .getTimeline()
      .find((e) => e.displayLabel === "Awaiting approval: bulk task update");
    expect(gate?.status).toBe("cancelled");
    expect(gate?.errorCode).toBeNull();
  });
});

describe("timeline projection", () => {
  it("returns newest first and respects the limit and project filter", async () => {
    const harness = await setup();
    const created = await call(harness, "create_project", { name: "Demo" });
    const projectId = (created.data.project as { id: string }).id;
    harness.clock.time += 1000;
    await call(harness, "create_task", { title: "T1" });
    harness.clock.time += 1000;
    await call(harness, "record_decision", { summary: "D", rationale: "r" });

    const timeline = harness.activity.getTimeline(2);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]!.toolName).toBe("record_decision");
    expect(timeline[1]!.toolName).toBe("create_task");

    const filtered = harness.activity.getTimeline(100, projectId);
    expect(filtered.every((e) => e.projectId === projectId)).toBe(true);
    expect(filtered).toHaveLength(3);
  });
});

describe("startup reconciliation", () => {
  it("cancels events left open by a previous process", async () => {
    const harness = await setup();
    // Simulate an event orphaned by a crash: inserted and then never resolved.
    const orphan = createActivityEvent(
      {
        toolName: "create_task",
        displayLabel: "Creating a task",
        department: "planning_bay",
      },
      { now: () => new Date(harness.clock.time) },
    );
    harness.ctx.events.insert(orphan);

    const cancelled = harness.activity.cancelOrphanedOpenEvents();
    expect(cancelled).toBe(1);
    const restored = harness.ctx.events.getById(orphan.id);
    expect(restored?.status).toBe("cancelled");
    expect(harness.activity.getCurrentActivity().idle).toBe(true);
  });
});
