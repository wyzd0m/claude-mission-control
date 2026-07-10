// Monitor server tests (D-025): serves the dashboard and the read model on
// 127.0.0.1, reflects live database changes, and never mutates state — in
// particular it must not cancel open events that belong to the running
// extension.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createActivityEvent, transitionEvent, type DashboardState } from "@mission-control/domain";
import { openDatabase } from "../storage/database.js";
import { createServiceContext } from "../services/service-context.js";
import { createProjectService } from "../services/project-service.js";
import {
  monitorAlreadyRunningAt,
  startMonitorServer,
  type MonitorServer,
} from "./monitor-server.js";

let tmpDir: string;
let dbPath: string;
let monitor: MonitorServer;

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmc-monitor-test-"));
  process.env.CMC_DATA_DIR = tmpDir;
  dbPath = path.join(tmpDir, "monitor-test.db");
  // Seed the database the way the extension would.
  const { db } = openDatabase(dbPath);
  const ctx = createServiceContext(db);
  createProjectService(ctx).create({ name: "Monitored", goal: "Watch me" });
  db.close();

  monitor = await startMonitorServer({ port: 0, dbPath });
});

afterEach(async () => {
  await monitor.close();
  delete process.env.CMC_UI_HTML;
  delete process.env.CMC_DATA_DIR;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function get(pathname: string) {
  return fetch(`http://127.0.0.1:${monitor.port}${pathname}`);
}

describe("monitor server", () => {
  it("serves the dashboard read model on /state", async () => {
    const response = await get("/state");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; state: DashboardState };
    expect(body.ok).toBe(true);
    expect(body.state.activeProject?.name).toBe("Monitored");
    expect(body.state.currentActivity.idle).toBe(true);
  });

  it("reflects changes written by another connection (the extension)", async () => {
    const { db } = openDatabase(dbPath);
    const ctx = createServiceContext(db);
    const event = createActivityEvent({
      toolName: "create_task",
      displayLabel: "Creating a task",
      department: "planning_bay",
    });
    ctx.events.insert(event);
    ctx.events.update(transitionEvent(transitionEvent(event, "working"), "succeeded"));
    db.close();

    const body = (await (await get("/state")).json()) as { state: DashboardState };
    expect(body.state.timeline).toHaveLength(1);
    expect(body.state.timeline[0]!.toolName).toBe("create_task");
  });

  it("never cancels open events that belong to the extension", async () => {
    const { db } = openDatabase(dbPath);
    const ctx = createServiceContext(db);
    const open = createActivityEvent({
      toolName: "preview_bulk_task_update",
      displayLabel: "Awaiting approval: bulk task update",
      department: "security_gate",
    });
    ctx.events.insert(open);
    ctx.events.update(transitionEvent(transitionEvent(open, "working"), "waiting_for_input"));
    db.close();

    const body = (await (await get("/state")).json()) as { state: DashboardState };
    expect(body.state.currentActivity.idle).toBe(false);
    expect(body.state.currentActivity.openEvents[0]!.status).toBe("waiting_for_input");

    // Still open on a second read: observing must not mutate.
    const again = (await (await get("/state")).json()) as { state: DashboardState };
    expect(again.state.currentActivity.openEvents[0]!.status).toBe("waiting_for_input");
  });

  it("serves the built dashboard HTML at /", async () => {
    const fixture = path.join(tmpDir, "dashboard.html");
    fs.writeFileSync(fixture, "<!doctype html><html><body>monitor</body></html>", "utf-8");
    process.env.CMC_UI_HTML = fixture;
    const response = await get("/");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("monitor");
  });

  it("answers /health with the database path and 404s unknown paths", async () => {
    const health = await get("/health");
    expect(health.status).toBe(200);
    const body = (await health.json()) as { ok: boolean; databasePath: string };
    expect(body.databasePath).toBe(dbPath);
    expect((await get("/nope")).status).toBe(404);
  });

  it("detects an already-running monitor so launchers can reuse it", async () => {
    expect(await monitorAlreadyRunningAt(monitor.port)).toBe(true);

    // A freed port is not a running monitor.
    const second = await startMonitorServer({ port: 0, dbPath });
    const freedPort = second.port;
    await second.close();
    expect(await monitorAlreadyRunningAt(freedPort)).toBe(false);
  });

  it("pushes fresh state over /events when another connection commits", async () => {
    const response = await fetch(`http://127.0.0.1:${monitor.port}/events`, {
      headers: { accept: "text/event-stream" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    async function readUntil(text: string, timeoutMs: number): Promise<string> {
      let collected = "";
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline && !collected.includes(text)) {
        const chunk = (await Promise.race([
          reader.read(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), deadline - Date.now())),
        ])) as { done: boolean; value?: Uint8Array } | null;
        if (chunk === null || chunk.done) break;
        collected += decoder.decode(chunk.value, { stream: true });
      }
      return collected;
    }

    // Immediate snapshot on subscribe.
    const snapshot = await readUntil("event: state", 2000);
    expect(snapshot).toContain("event: state");
    expect(snapshot).toContain("Monitored");

    // A commit from another connection (the extension) is pushed without
    // any request from the client.
    const { db } = openDatabase(dbPath);
    createProjectService(createServiceContext(db)).create({ name: "Pushed", goal: "Fast" });
    db.close();
    const pushed = await readUntil("Pushed", 4000);
    expect(pushed).toContain("Pushed");

    await reader.cancel();
  });

  it("does not mistake another application for a monitor", async () => {
    const impostor = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("hello");
    });
    await new Promise<void>((resolve) => impostor.listen(0, "127.0.0.1", resolve));
    const address = impostor.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    expect(await monitorAlreadyRunningAt(port)).toBe(false);
    await new Promise<void>((resolve, reject) =>
      impostor.close((error) => (error ? reject(error) : resolve())),
    );
  });
});
