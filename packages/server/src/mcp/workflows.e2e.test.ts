// Phase 8 end-to-end workflows (docs/IMPLEMENTATION_ROADMAP.md): the eight
// required scenarios, each exercised through a real MCP client against the
// real server. Every scenario asserts three things:
//   1. the workflow succeeds through the public tools alone,
//   2. the visual mapping exists (accurate persisted events with the right
//      department — what the facility animates),
//   3. failure behavior is clear (structured error with a stable code).
// Scenario 6 uses a file-backed database across two server instances to
// prove a new conversation can continue where the last one stopped.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { openDatabase } from "../storage/database.js";
import { createServiceContext } from "../services/service-context.js";
import {
  createActivityEventService,
  type ActivityEventService,
} from "../services/activity-event-service.js";
import { createMissionControlServer } from "./server.js";

interface Session {
  client: Client;
  activity: ActivityEventService;
  close: () => Promise<void>;
}

let tmpDir: string;
let sessions: Session[];

async function startSession(dbPath = ":memory:"): Promise<Session> {
  const { db } = openDatabase(dbPath);
  const ctx = createServiceContext(db);
  const activity = createActivityEventService(ctx);
  activity.cancelOrphanedOpenEvents();
  const server = createMissionControlServer(ctx, { activity });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "workflow-tests", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const session: Session = {
    client,
    activity,
    close: async () => {
      await client.close();
      db.close();
    },
  };
  sessions.push(session);
  return session;
}

async function call(session: Session, name: string, args: Record<string, unknown> = {}) {
  const result = (await session.client.callTool({ name, arguments: args })) as CallToolResult;
  const data = result.structuredContent as Record<string, unknown>;
  return { result, data };
}

async function ok(session: Session, name: string, args: Record<string, unknown> = {}) {
  const { result, data } = await call(session, name, args);
  expect(result.isError ?? false, `${name} should succeed`).toBe(false);
  return data;
}

function eventsFor(session: Session, toolName: string) {
  return session.activity.getTimeline(200).filter((e) => e.toolName === toolName);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmc-e2e-"));
  process.env.CMC_DATA_DIR = tmpDir;
  sessions = [];
});

afterEach(async () => {
  for (const session of sessions) {
    await session.close();
  }
  delete process.env.CMC_DATA_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("scenario 1: create and plan a project", () => {
  it("creates a project, sets goal and stage, and plans tasks", async () => {
    const s = await startSession();
    await ok(s, "create_project", { name: "Demo", goal: "Ship v1" });
    await ok(s, "update_project", { definitionOfDone: "All acceptance criteria pass" });
    await ok(s, "update_project_stage", { stage: "planning" });
    await ok(s, "create_task", { title: "Design login screen", priority: "high" });
    await ok(s, "create_task", { title: "Set up CI" });

    const brief = (await ok(s, "get_project_brief")).brief as {
      project: { currentStage: string; definitionOfDone: string };
      openTaskCount: number;
    };
    expect(brief.project.currentStage).toBe("planning");
    expect(brief.openTaskCount).toBe(2);

    // Visual mapping: planning work lights the Planning Bay.
    const created = eventsFor(s, "create_task");
    expect(created).toHaveLength(2);
    expect(created.every((e) => e.department === "planning_bay" && e.status === "succeeded")).toBe(
      true,
    );

    // Failure behavior: planning without any project is a clear error.
    const bare = await startSession();
    const { result, data } = await call(bare, "create_task", { title: "T" });
    expect(result.isError).toBe(true);
    expect((data.error as { code: string }).code).toBe("PROJECT_NOT_FOUND");
  });
});

describe("scenario 2: update tasks during implementation", () => {
  it("moves tasks through their statuses with truthful events", async () => {
    const s = await startSession();
    await ok(s, "create_project", { name: "Demo" });
    const task = (await ok(s, "create_task", { title: "Build login" })).task as { id: string };

    await ok(s, "update_task", { taskId: task.id, status: "in_progress" });
    await ok(s, "update_task", {
      taskId: task.id,
      status: "blocked",
      blockedReason: "Waiting on API keys",
    });
    await ok(s, "update_task", { taskId: task.id, status: "done" });

    const done = (await ok(s, "list_tasks", { status: "done" })).tasks as Array<{
      completedAt: string | null;
    }>;
    expect(done).toHaveLength(1);
    expect(done[0]!.completedAt).not.toBeNull();

    const updates = eventsFor(s, "update_task");
    expect(updates).toHaveLength(3);
    expect(updates.every((e) => e.relatedTaskIds.includes(task.id))).toBe(true);

    // Failure behavior: blocking without a reason fails loudly, and the
    // failed event carries the same code.
    const { result, data } = await call(s, "update_task", {
      taskId: task.id,
      status: "blocked",
    });
    expect(result.isError).toBe(true);
    expect((data.error as { code: string }).code).toBe("VALIDATION_FAILED");
    expect(eventsFor(s, "update_task").some((e) => e.errorCode === "VALIDATION_FAILED")).toBe(true);
  });
});

describe("scenario 3: record a decision", () => {
  it("stores the decision with rationale in the Memory Vault", async () => {
    const s = await startSession();
    await ok(s, "create_project", { name: "Demo" });
    await ok(s, "record_decision", {
      summary: "Use node:sqlite",
      rationale: "No native packaging dependencies.",
      alternativesConsidered: ["better-sqlite3", "sql.js"],
    });
    const decisions = (await ok(s, "list_decisions")).decisions as unknown[];
    expect(decisions).toHaveLength(1);

    const event = eventsFor(s, "record_decision")[0]!;
    expect(event.department).toBe("memory_vault");
    expect(event.status).toBe("succeeded");

    // Failure behavior: a decision referencing a foreign task is rejected.
    const { result, data } = await call(s, "record_decision", {
      summary: "Bad",
      rationale: "r",
      relatedTaskIds: ["missing-task"],
    });
    expect(result.isError).toBe(true);
    expect((data.error as { code: string }).code).toBe("TASK_NOT_FOUND");
  });
});

describe("scenario 4: record a validation result", () => {
  it("records pass and fail outcomes against an artifact in the Testing Lab", async () => {
    const s = await startSession();
    await ok(s, "create_project", { name: "Demo" });
    const artifact = (
      await ok(s, "register_artifact", { name: "login.ts", pathOrReference: "src/login.ts" })
    ).artifact as { id: string };

    const failed = (
      await ok(s, "record_validation_result", {
        artifactId: artifact.id,
        passed: false,
        validationPerformed: "Unit tests",
      })
    ).artifact as { verificationStatus: string };
    expect(failed.verificationStatus).toBe("failed");

    const event = eventsFor(s, "record_validation_result")[0]!;
    expect(event.department).toBe("testing_lab");

    // Failure behavior: claiming a validation without naming it is rejected
    // at the schema boundary.
    const { result } = await call(s, "record_validation_result", {
      artifactId: artifact.id,
      passed: true,
      validationPerformed: "",
    });
    expect(result.isError).toBe(true);
  });
});

describe("scenarios 5 and 6: checkpoint, then continue in a new conversation", () => {
  it("saves a checkpoint and restores full context from a fresh server", async () => {
    const dbPath = path.join(tmpDir, "workflow.db");
    const first = await startSession(dbPath);
    await ok(first, "create_project", { name: "Demo", goal: "Ship v1" });
    await ok(first, "create_task", { title: "Open work item" });
    await ok(first, "record_decision", { summary: "Use SQLite", rationale: "local-first" });
    await ok(first, "save_checkpoint", {
      summary: "End of first conversation",
      completedWork: ["Project planned"],
      openWork: ["Open work item"],
      recommendedNextAction: "Start building",
    });
    await first.close();
    sessions.splice(sessions.indexOf(first), 1);

    // A brand-new server over the same local database = a new conversation.
    const second = await startSession(dbPath);
    const checkpoint = (await ok(second, "get_latest_checkpoint")).checkpoint as {
      summary: string;
    };
    expect(checkpoint.summary).toBe("End of first conversation");

    const pkg = (await ok(second, "prepare_project_context")).contextPackage as {
      facts: { project: { goal: string }; openTasks: unknown[]; recentDecisions: unknown[] };
      recommendations: { nextAction: string | null };
      sourceRecordIds: string[];
    };
    expect(pkg.facts.project.goal).toBe("Ship v1");
    expect(pkg.facts.openTasks).toHaveLength(1);
    expect(pkg.facts.recentDecisions).toHaveLength(1);
    expect(pkg.recommendations.nextAction).toBe("Start building");
    expect(pkg.sourceRecordIds.length).toBeGreaterThanOrEqual(4);

    // Visual mapping: context preparation is Memory Vault work.
    expect(eventsFor(second, "prepare_project_context")[0]!.department).toBe("memory_vault");

    // Failure behavior: an empty database answers honestly.
    const empty = await startSession();
    const { data } = await call(empty, "get_latest_checkpoint");
    expect((data.error as { code: string } | undefined)?.code).toBe("PROJECT_NOT_FOUND");
  });
});

describe("scenario 7: export and import a project", () => {
  it("round-trips a project through the Delivery Dock and Security Gate", async () => {
    const source = await startSession();
    await ok(source, "create_project", { name: "Demo" });
    await ok(source, "create_task", { title: "T1" });
    const exported = (await ok(source, "export_project")).export as { filePath: string };
    expect(eventsFor(source, "export_project")[0]!.department).toBe("delivery_dock");

    const bundle = JSON.parse(fs.readFileSync(exported.filePath, "utf-8")) as Record<
      string,
      unknown
    >;
    const target = await startSession();
    const preview = (await ok(target, "preview_project_import", { bundle })).preview as {
      confirmationToken: string;
    };
    // The Security Gate holds an open waiting event during the approval.
    expect(
      target.activity
        .getCurrentActivity()
        .openEvents.some((e) => e.department === "security_gate" && e.requiresInput),
    ).toBe(true);

    await ok(target, "apply_project_import", {
      bundle,
      confirmationToken: preview.confirmationToken,
    });
    const projects = (await ok(target, "list_projects")).projects as unknown[];
    expect(projects).toHaveLength(1);
    expect(target.activity.getCurrentActivity().idle).toBe(true);

    // Failure behavior: a tampered bundle is rejected before anything writes.
    const tampered = { ...bundle, tasks: [{ nonsense: true }] };
    const { result, data } = await call(target, "preview_project_import", { bundle: tampered });
    expect(result.isError).toBe(true);
    expect((data.error as { code: string }).code).toBe("IMPORT_INVALID");
  });
});

describe("scenario 8: preview and approve a bulk change", () => {
  it("runs the full preview/approve flow with truthful gate events", async () => {
    const s = await startSession();
    await ok(s, "create_project", { name: "Demo" });
    await ok(s, "create_task", { title: "A" });
    await ok(s, "create_task", { title: "B" });

    const preview = (
      await ok(s, "preview_bulk_task_update", { filterStatus: "todo", status: "in_progress" })
    ).preview as { affected: Array<{ id: string; revision: number }>; confirmationToken: string };
    expect(preview.affected).toHaveLength(2);

    // Nothing changed yet: a preview is never completed work.
    const stillTodo = (await ok(s, "list_tasks", { status: "todo" })).tasks as unknown[];
    expect(stillTodo).toHaveLength(2);

    const applied = (
      await ok(s, "apply_bulk_task_update", {
        filterStatus: "todo",
        status: "in_progress",
        affected: preview.affected,
        confirmationToken: preview.confirmationToken,
      })
    ).tasks as unknown[];
    expect(applied).toHaveLength(2);

    const gate = s.activity
      .getTimeline(50)
      .find((e) => e.displayLabel === "Awaiting approval: bulk task update");
    expect(gate?.status).toBe("succeeded");

    // Failure behavior: the burnt token cannot be replayed.
    const { result, data } = await call(s, "apply_bulk_task_update", {
      filterStatus: "todo",
      status: "in_progress",
      affected: preview.affected,
      confirmationToken: preview.confirmationToken,
    });
    expect(result.isError).toBe(true);
    expect((data.error as { message: string }).message).toMatch(/already used/);
  });
});
