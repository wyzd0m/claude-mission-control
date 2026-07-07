// Tests for the Phase 5 dashboard tools: the MCP App tool declares its UI
// resource, the state tool returns the read model, dashboard reads stay out
// of the activity timeline (D-022), and the UI resource serves the built
// single-file HTML.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DashboardState } from "@mission-control/domain";
import { openDatabase } from "../storage/database.js";
import { createServiceContext } from "../services/service-context.js";
import {
  createActivityEventService,
  type ActivityEventService,
} from "../services/activity-event-service.js";
import { createMissionControlServer } from "./server.js";
import { DASHBOARD_RESOURCE_URI } from "./ui-resource.js";

let tmpDir: string;
let client: Client;
let activity: ActivityEventService;
let closeAll: () => Promise<void>;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmc-dash-test-"));
  process.env.CMC_DATA_DIR = tmpDir;
  const { db } = openDatabase(":memory:");
  const ctx = createServiceContext(db);
  activity = createActivityEventService(ctx);
  const server = createMissionControlServer(ctx, { activity });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "dash-tests", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  closeAll = async () => {
    await client.close();
    db.close();
  };
});

afterEach(async () => {
  await closeAll();
  delete process.env.CMC_DATA_DIR;
  delete process.env.CMC_UI_HTML;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  return { result, data: result.structuredContent as Record<string, unknown> };
}

describe("dashboard tools", () => {
  it("declares the MCP App UI resource on open_mission_control", async () => {
    const { tools } = await client.listTools();
    const openTool = tools.find((t) => t.name === "open_mission_control");
    expect(openTool).toBeDefined();
    const ui = (openTool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
    expect(ui?.resourceUri).toBe(DASHBOARD_RESOURCE_URI);
    expect(openTool?.description).toMatch(/No side effects/);
  });

  it("returns the dashboard read model with honest idle state", async () => {
    await call("create_project", { name: "Demo" });
    await call("create_task", { title: "T1" });

    const { data } = await call("get_mission_control_state");
    expect(data.ok).toBe(true);
    const state = data.state as DashboardState;
    expect(state.activeProject?.name).toBe("Demo");
    expect(state.tasks).toHaveLength(1);
    expect(state.projectProgress).toEqual({ doneTasks: 0, totalTasks: 1 });
    expect(state.currentActivity.idle).toBe(true);
    expect(state.currentActivity.idleMessage).toBe(
      "Waiting for the next observable Mission Control activity.",
    );
    expect(state.timeline.length).toBe(2);
  });

  it("keeps dashboard state reads out of the activity timeline (D-022)", async () => {
    await call("create_project", { name: "Demo" });
    const before = activity.getTimeline().length;
    await call("get_mission_control_state");
    await call("open_mission_control");
    expect(activity.getTimeline().length).toBe(before);
  });

  it("serves the built dashboard HTML as the UI resource", async () => {
    const fixture = path.join(tmpDir, "dashboard.html");
    fs.writeFileSync(fixture, "<!doctype html><html><body>dash</body></html>", "utf-8");
    process.env.CMC_UI_HTML = fixture;

    const result = await client.readResource({ uri: DASHBOARD_RESOURCE_URI });
    const first = result.contents[0] as { text?: string };
    expect(first.text).toContain("dash");
  });

  it("fails resource reads with a recovery hint when the UI is not built", async () => {
    process.env.CMC_UI_HTML = path.join(tmpDir, "missing.html");
    await expect(client.readResource({ uri: DASHBOARD_RESOURCE_URI })).rejects.toThrow(
      /build:dashboard|CMC_UI_HTML/,
    );
  });
});
