import fs from "node:fs";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { POC_VERSION } from "../../shared/poc-types.js";
import { loadState, noteServerStart, recordTestEvent, toSnapshot } from "./state.js";
import { stateFilePath } from "./paths.js";

// This file is bundled to CommonJS, so __dirname is available at runtime and
// points at <bundle>/server. The UI ships alongside it at <bundle>/ui.
const UI_HTML_PATH = path.join(__dirname, "..", "ui", "mcp-app.html");
const UI_RESOURCE_URI = "ui://claude-mission-control/poc/mcp-app.html";

const snapshotShape = {
  pocVersion: z.string(),
  stateFilePath: z.string(),
  createdAt: z.string(),
  serverStartCount: z.number().int(),
  eventCount: z.number().int(),
  recentEvents: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      occurredAt: z.string(),
    }),
  ),
};

function snapshotResult() {
  const snapshot = toSnapshot(loadState());
  return {
    content: [
      {
        type: "text" as const,
        text:
          `Mission Control PoC state: ${snapshot.eventCount} recorded test event(s), ` +
          `server started ${snapshot.serverStartCount} time(s), state stored at ${snapshot.stateFilePath}.`,
      },
    ],
    structuredContent: snapshot as unknown as Record<string, unknown>,
  };
}

const server = new McpServer({
  name: "claude-mission-control-poc",
  version: POC_VERSION,
});

// Harmless connectivity test tool. No side effects.
server.registerTool(
  "mission_control_ping",
  {
    title: "Mission Control ping",
    description:
      "Phase 0 connectivity check for the Claude Mission Control proof of concept. " +
      "Returns server time and version. Has no side effects.",
    inputSchema: {
      echo: z
        .string()
        .max(200)
        .optional()
        .describe("Optional text to echo back, for round-trip verification."),
    },
    outputSchema: {
      ok: z.boolean(),
      pocVersion: z.string(),
      serverTime: z.string(),
      echo: z.string().optional(),
    },
  },
  async ({ echo }) => {
    const payload = {
      ok: true,
      pocVersion: POC_VERSION,
      serverTime: new Date().toISOString(),
      ...(echo === undefined ? {} : { echo }),
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
);

// The MCP App tool: opens the PoC dashboard and hands it the persisted state.
registerAppTool(
  server,
  "open_mission_control_poc",
  {
    title: "Open Mission Control PoC dashboard",
    description:
      "Opens the Claude Mission Control Phase 0 proof-of-concept dashboard. " +
      "Shows only saved PoC state and observable PoC tool activity. Read-only.",
    inputSchema: {},
    outputSchema: snapshotShape,
    _meta: { ui: { resourceUri: UI_RESOURCE_URI } },
  },
  async () => snapshotResult(),
);

// The one state-changing tool: records a timestamped test event so a real,
// observable tool call can be seen changing UI state and surviving restart.
server.registerTool(
  "record_poc_event",
  {
    title: "Record PoC test event",
    description:
      "Records a timestamped test event in the local Mission Control PoC state file. " +
      "Side effect: appends one event (capped history) to local storage. No other data is touched.",
    inputSchema: {
      label: z
        .string()
        .min(1)
        .max(120)
        .optional()
        .describe("Optional short label for the test event."),
    },
    outputSchema: snapshotShape,
  },
  async ({ label }) => {
    recordTestEvent(label ?? "Unlabeled test event");
    return snapshotResult();
  },
);

// Serve the single-file UI as an MCP App resource.
registerAppResource(
  server,
  "Mission Control PoC dashboard",
  UI_RESOURCE_URI,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    const html = fs.readFileSync(UI_HTML_PATH, "utf-8");
    return {
      contents: [{ uri: UI_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
    };
  },
);

async function main() {
  const state = noteServerStart();
  // stdout carries the MCP protocol; all logging goes to stderr.
  console.error(
    `[poc] claude-mission-control-poc v${POC_VERSION} starting ` +
      `(start #${state.serverStartCount}, state file: ${stateFilePath()})`,
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[poc] connected over stdio");
}

main().catch((error) => {
  console.error("[poc] fatal startup error", error);
  process.exit(1);
});
