// Protocol-level tests for the Phase 3 tool set: a real MCP client talks to
// the real server over an in-memory transport, backed by an in-memory SQLite
// database. This exercises the same registration, validation, and result
// paths Claude Desktop uses, without process spawning.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { openDatabase } from "../storage/database.js";
import { createServiceContext } from "../services/service-context.js";
import { createMissionControlServer } from "./server.js";

interface Harness {
  client: Client;
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
  const server = createMissionControlServer(ctx);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "phase3-tests", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const harness: Harness = {
    client,
    clock,
    close: async () => {
      await client.close();
      db.close();
    },
  };
  harnesses.push(harness);
  return harness;
}

type Structured = { ok: boolean } & Record<string, unknown>;

async function call(
  harness: Harness,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ result: CallToolResult; data: Structured }> {
  const result = (await harness.client.callTool({ name, arguments: args })) as CallToolResult;
  return { result, data: result.structuredContent as Structured };
}

async function expectToolError(
  harness: Harness,
  name: string,
  args: Record<string, unknown>,
  code: string,
): Promise<{ code: string; message: string; recovery: string }> {
  const { result, data } = await call(harness, name, args);
  expect(result.isError).toBe(true);
  const error = (data as unknown as { error: { code: string; message: string; recovery: string } })
    .error;
  expect(error.code).toBe(code);
  expect(error.recovery).toBeTruthy();
  return error;
}

beforeEach(() => {
  tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmc-mcp-test-"));
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

describe("tool discovery", () => {
  it("lists the full Phase 3 tool set with side effects documented", async () => {
    const harness = await setup();
    const { tools } = await harness.client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "create_project",
        "list_projects",
        "get_project_brief",
        "set_active_project",
        "update_project",
        "update_project_stage",
        "archive_project",
        "create_task",
        "update_task",
        "list_tasks",
        "preview_bulk_task_update",
        "apply_bulk_task_update",
        "record_decision",
        "list_decisions",
        "save_checkpoint",
        "get_latest_checkpoint",
        "prepare_project_context",
        "register_artifact",
        "list_artifacts",
        "mark_artifact_verified",
        "record_validation_result",
        "export_project",
        "preview_project_import",
        "apply_project_import",
        "open_mission_control",
        "get_mission_control_state",
        "get_diagnostics",
      ].sort(),
    );
    for (const tool of tools) {
      expect(tool.description, tool.name).toMatch(/side effect/i);
    }
  });
});

describe("project tools", () => {
  it("creates a project, makes it active, and serves the brief", async () => {
    const harness = await setup();
    const created = await call(harness, "create_project", {
      name: "Demo",
      goal: "Ship v1",
    });
    expect(created.data.ok).toBe(true);
    const project = created.data.project as { id: string; currentStage: string };
    expect(project.currentStage).toBe("discovery");

    const listed = await call(harness, "list_projects");
    expect(listed.data.activeProjectId).toBe(project.id);

    // No projectId: the active project is used.
    const brief = await call(harness, "get_project_brief");
    expect((brief.data.brief as { project: { id: string } }).project.id).toBe(project.id);
    expect((brief.data.brief as { isActive: boolean }).isActive).toBe(true);
  });

  it("changes the stage only through the explicit tool", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    const moved = await call(harness, "update_project_stage", { stage: "building" });
    expect((moved.data.project as { currentStage: string }).currentStage).toBe("building");
  });

  it("returns PROJECT_NOT_FOUND with recovery for unknown projects", async () => {
    const harness = await setup();
    const error = await expectToolError(
      harness,
      "get_project_brief",
      { projectId: "missing" },
      "PROJECT_NOT_FOUND",
    );
    expect(error.recovery).toMatch(/list_projects|create_project/);
  });

  it("archiving clears the active project", async () => {
    const harness = await setup();
    const created = await call(harness, "create_project", { name: "Demo" });
    const id = (created.data.project as { id: string }).id;
    await call(harness, "archive_project", { projectId: id });
    const listed = await call(harness, "list_projects");
    expect(listed.data.activeProjectId).toBeNull();
  });
});

describe("task tools", () => {
  it("creates, updates, and lists tasks with filters", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    const created = await call(harness, "create_task", { title: "Build login screen" });
    const task = created.data.task as { id: string; status: string };
    expect(task.status).toBe("todo");

    await call(harness, "update_task", { taskId: task.id, status: "in_progress" });
    const listed = await call(harness, "list_tasks", { status: "in_progress" });
    expect(listed.data.tasks).toHaveLength(1);
  });

  it("surfaces domain rules as structured validation errors", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    const created = await call(harness, "create_task", { title: "T" });
    const task = created.data.task as { id: string };
    const error = await expectToolError(
      harness,
      "update_task",
      { taskId: task.id, status: "blocked" },
      "VALIDATION_FAILED",
    );
    expect(error.message).toMatch(/blocked reason/);
  });

  it("requires a project before task creation", async () => {
    const harness = await setup();
    await expectToolError(harness, "create_task", { title: "T" }, "PROJECT_NOT_FOUND");
  });
});

describe("decision, checkpoint, and context tools", () => {
  it("records and lists decisions", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    await call(harness, "record_decision", {
      summary: "Use node:sqlite",
      rationale: "No native dependencies.",
      alternativesConsidered: ["better-sqlite3"],
    });
    const listed = await call(harness, "list_decisions");
    expect(listed.data.decisions).toHaveLength(1);
  });

  it("saves and retrieves the latest checkpoint", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    const empty = await call(harness, "get_latest_checkpoint");
    expect(empty.data.checkpoint).toBeNull();

    await call(harness, "save_checkpoint", {
      summary: "End of session",
      completedWork: ["Domain model"],
      recommendedNextAction: "Start phase 3",
    });
    const latest = await call(harness, "get_latest_checkpoint");
    expect((latest.data.checkpoint as { summary: string }).summary).toBe("End of session");
  });

  it("prepares a selective context package with source ids", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo", goal: "Ship" });
    const open = await call(harness, "create_task", { title: "Open task" });
    const done = await call(harness, "create_task", { title: "Done task" });
    await call(harness, "update_task", {
      taskId: (done.data.task as { id: string }).id,
      status: "done",
    });
    await call(harness, "record_decision", { summary: "D1", rationale: "r" });
    await call(harness, "save_checkpoint", { summary: "cp", recommendedNextAction: "Do X" });

    const result = await call(harness, "prepare_project_context");
    const pkg = result.data.contextPackage as {
      facts: {
        openTasks: Array<{ id: string }>;
        recentDecisions: unknown[];
        latestCheckpoint: { summary: string };
      };
      recommendations: { nextAction: string | null };
      sourceRecordIds: string[];
    };
    expect(pkg.facts.openTasks.map((t) => t.id)).toEqual([(open.data.task as { id: string }).id]);
    expect(pkg.facts.recentDecisions).toHaveLength(1);
    expect(pkg.facts.latestCheckpoint.summary).toBe("cp");
    expect(pkg.recommendations.nextAction).toBe("Do X");
    expect(pkg.sourceRecordIds.length).toBeGreaterThanOrEqual(4);
  });
});

describe("artifact and validation tools", () => {
  it("registers artifacts and records validation outcomes", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    const registered = await call(harness, "register_artifact", {
      name: "login.ts",
      pathOrReference: "src/login.ts",
    });
    const artifact = registered.data.artifact as { id: string; verificationStatus: string };
    expect(artifact.verificationStatus).toBe("unverified");

    const failed = await call(harness, "record_validation_result", {
      artifactId: artifact.id,
      passed: false,
      validationPerformed: "Type check",
    });
    expect((failed.data.artifact as { verificationStatus: string }).verificationStatus).toBe(
      "failed",
    );

    const verified = await call(harness, "mark_artifact_verified", {
      artifactId: artifact.id,
      status: "verified",
      validationPerformed: "Unit tests passed",
    });
    expect((verified.data.artifact as { verificationStatus: string }).verificationStatus).toBe(
      "verified",
    );
  });
});

describe("bulk update preview/apply", () => {
  async function seedBulk(harness: Harness) {
    await call(harness, "create_project", { name: "Demo" });
    await call(harness, "create_task", { title: "A" });
    await call(harness, "create_task", { title: "B" });
    const preview = await call(harness, "preview_bulk_task_update", {
      filterStatus: "todo",
      status: "in_progress",
    });
    return preview.data.preview as {
      affected: Array<{ id: string; revision: number }>;
      confirmationToken: string;
    };
  }

  it("applies a previewed change and rejects token reuse", async () => {
    const harness = await setup();
    const preview = await seedBulk(harness);
    const applyArgs = {
      filterStatus: "todo",
      status: "in_progress",
      affected: preview.affected.map(({ id, revision }) => ({ id, revision })),
      confirmationToken: preview.confirmationToken,
    };
    const applied = await call(harness, "apply_bulk_task_update", applyArgs);
    expect(applied.data.tasks).toHaveLength(2);

    const reuse = await expectToolError(
      harness,
      "apply_bulk_task_update",
      applyArgs,
      "VALIDATION_FAILED",
    );
    expect(reuse.message).toMatch(/already used/);
  });

  it("rejects expired tokens", async () => {
    const harness = await setup({ approvalTtlMs: 1000 });
    const preview = await seedBulk(harness);
    harness.clock.time += 2000;
    const error = await expectToolError(
      harness,
      "apply_bulk_task_update",
      {
        filterStatus: "todo",
        status: "in_progress",
        affected: preview.affected.map(({ id, revision }) => ({ id, revision })),
        confirmationToken: preview.confirmationToken,
      },
      "VALIDATION_FAILED",
    );
    expect(error.message).toMatch(/expired/);
  });

  it("conflicts when a task changed after the preview", async () => {
    const harness = await setup();
    const preview = await seedBulk(harness);
    await call(harness, "update_task", { taskId: preview.affected[0]!.id, priority: "high" });
    await expectToolError(
      harness,
      "apply_bulk_task_update",
      {
        filterStatus: "todo",
        status: "in_progress",
        affected: preview.affected.map(({ id, revision }) => ({ id, revision })),
        confirmationToken: preview.confirmationToken,
      },
      "REVISION_CONFLICT",
    );
  });

  it("previews nothing when no tasks match", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    await expectToolError(
      harness,
      "preview_bulk_task_update",
      { filterStatus: "done", status: "todo" },
      "VALIDATION_FAILED",
    );
  });
});

describe("export and import tools", () => {
  it("exports to the managed exports directory", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo Project" });
    await call(harness, "create_task", { title: "T1" });
    const result = await call(harness, "export_project");
    const exportInfo = result.data.export as { filePath: string; counts: { tasks: number } };
    expect(exportInfo.counts.tasks).toBe(1);
    expect(exportInfo.filePath.startsWith(tmpDataDir)).toBe(true);
    expect(fs.existsSync(exportInfo.filePath)).toBe(true);
  });

  it("previews and applies an import into a fresh database", async () => {
    const source = await setup();
    await call(source, "create_project", { name: "Demo" });
    await call(source, "create_task", { title: "T1" });
    const exported = await call(source, "export_project");
    const bundle = JSON.parse(
      fs.readFileSync((exported.data.export as { filePath: string }).filePath, "utf-8"),
    ) as Record<string, unknown>;

    const target = await setup();
    const preview = await call(target, "preview_project_import", { bundle });
    const previewInfo = preview.data.preview as {
      confirmationToken: string;
      counts: { tasks: number };
    };
    expect(previewInfo.counts.tasks).toBe(1);

    const applied = await call(target, "apply_project_import", {
      bundle,
      confirmationToken: previewInfo.confirmationToken,
    });
    expect((applied.data.project as { name: string }).name).toBe("Demo");

    const listed = await call(target, "list_projects");
    expect(listed.data.projects).toHaveLength(1);
  });

  it("rejects importing over an existing project", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    const exported = await call(harness, "export_project");
    const bundle = JSON.parse(
      fs.readFileSync((exported.data.export as { filePath: string }).filePath, "utf-8"),
    ) as Record<string, unknown>;
    const preview = await call(harness, "preview_project_import", { bundle });
    await expectToolError(
      harness,
      "apply_project_import",
      {
        bundle,
        confirmationToken: (preview.data.preview as { confirmationToken: string })
          .confirmationToken,
      },
      "IMPORT_CONFLICT",
    );
  });

  it("rejects an invalid bundle with IMPORT_INVALID", async () => {
    const harness = await setup();
    await expectToolError(
      harness,
      "preview_project_import",
      { bundle: { nonsense: true } },
      "IMPORT_INVALID",
    );
  });

  it("rejects apply without a valid preview token", async () => {
    const harness = await setup();
    await call(harness, "create_project", { name: "Demo" });
    const exported = await call(harness, "export_project");
    const bundle = JSON.parse(
      fs.readFileSync((exported.data.export as { filePath: string }).filePath, "utf-8"),
    ) as Record<string, unknown>;
    const error = await expectToolError(
      harness,
      "apply_project_import",
      { bundle, confirmationToken: "forged" },
      "VALIDATION_FAILED",
    );
    expect(error.message).toMatch(/unknown token/);
  });
});
