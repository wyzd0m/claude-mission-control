// Protocol-level smoke tests for the Phase 0 PoC server.
// Spawns the actual built bundle (dist/bundle/server/index.js) over stdio,
// exactly the way Claude Desktop launches it, and verifies:
//   - the three tools are listed and the app tool declares its UI resource
//   - the UI resource serves the bundled single-file HTML
//   - the ping tool round-trips
//   - record_poc_event persists state that survives a server restart
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(here, "..", "dist", "bundle", "server", "index.js");
const uiResourceUri = "ui://claude-mission-control/poc/mcp-app.html";

let dataDir: string;
const openClients: Client[] = [];

async function connect(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: { ...process.env, CMC_POC_DATA_DIR: dataDir },
    stderr: "pipe",
  });
  const client = new Client({ name: "poc-test-client", version: "0.0.1" });
  await client.connect(transport);
  openClients.push(client);
  return client;
}

beforeAll(() => {
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Built server not found at ${serverEntry}. Run \`npm run build\` before \`npm test\`.`);
  }
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmc-poc-test-"));
});

afterEach(async () => {
  while (openClients.length > 0) {
    await openClients.pop()?.close();
  }
});

describe("PoC MCP server", () => {
  it("lists the PoC tools and declares the MCP App UI resource", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["mission_control_ping", "open_mission_control_poc", "record_poc_event"]);

    const appTool = tools.find((t) => t.name === "open_mission_control_poc");
    const ui = (appTool?._meta as { ui?: { resourceUri?: string } } | undefined)?.ui;
    expect(ui?.resourceUri).toBe(uiResourceUri);
  });

  it("serves the bundled single-file UI as a resource", async () => {
    const client = await connect();
    const result = await client.readResource({ uri: uiResourceUri });
    const first = result.contents[0];
    expect(first).toBeDefined();
    const html = (first as { text?: string }).text ?? "";
    expect(html).toContain("<!doctype html>");
    // The single-file build inlines all scripts; there must be no external src.
    expect(html).toContain("<script");
    expect(html).not.toMatch(/<script[^>]+src=/);
  });

  it("answers mission_control_ping with a structured result", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "mission_control_ping",
      arguments: { echo: "hello" },
    });
    expect(result.isError ?? false).toBe(false);
    const structured = result.structuredContent as { ok: boolean; echo?: string };
    expect(structured.ok).toBe(true);
    expect(structured.echo).toBe("hello");
  });

  it("records events and keeps them across a server restart", async () => {
    const clientA = await connect();
    const first = await clientA.callTool({
      name: "record_poc_event",
      arguments: { label: "automated test event" },
    });
    const afterFirst = first.structuredContent as { eventCount: number };
    const countAfterFirst = afterFirst.eventCount;
    expect(countAfterFirst).toBeGreaterThanOrEqual(1);
    await clientA.close();

    // New process = simulated restart. State must come back from disk.
    const clientB = await connect();
    const opened = await clientB.callTool({ name: "open_mission_control_poc", arguments: {} });
    const snapshot = opened.structuredContent as {
      eventCount: number;
      serverStartCount: number;
      recentEvents: Array<{ label: string }>;
    };
    expect(snapshot.eventCount).toBe(countAfterFirst);
    expect(snapshot.serverStartCount).toBeGreaterThanOrEqual(2);
    expect(snapshot.recentEvents.at(-1)?.label).toBe("automated test event");
  });

  it("rejects invalid input", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "record_poc_event",
      arguments: { label: "x".repeat(500) },
    });
    expect(result.isError).toBe(true);
  });
});
