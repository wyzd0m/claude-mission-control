// Smoke test for the packaged bundle (Phase 9): launches dist/bundle/server/
// index.js over stdio exactly the way Claude Desktop does, then verifies the
// handshake, the tool list, the dashboard resource, and one real tool call
// against an isolated temp data directory. Exits non-zero on any failure.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "dist", "bundle", "server", "index.js");
if (!fs.existsSync(entry)) {
  console.error(`Bundle not built at ${entry}. Run: npm run build:bundle`);
  process.exit(1);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cmc-smoke-"));
const child = spawn(process.execPath, [entry], {
  env: { ...process.env, CMC_DATA_DIR: dataDir },
  stdio: ["pipe", "pipe", "pipe"],
});

let nextId = 0;
const pending = new Map();
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += String(chunk);
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    if (line.trim() === "") continue;
    const message = JSON.parse(line);
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  }
});
const stderrLines = [];
child.stderr.on("data", (chunk) => stderrLines.push(String(chunk)));

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`timeout waiting for ${method}`));
    }, 15000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function assert(condition, label) {
  if (!condition) {
    console.error(`SMOKE FAIL: ${label}`);
    console.error(stderrLines.join(""));
    child.kill();
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

try {
  const init = await request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0" },
  });
  assert(init.result?.serverInfo?.name === "claude-mission-control", "initialize handshake");
  notify("notifications/initialized", {});

  const tools = await request("tools/list", {});
  const names = tools.result.tools.map((t) => t.name);
  assert(names.length === 29, `29 tools listed (got ${names.length})`);
  assert(names.includes("open_mission_control"), "dashboard tool present");
  const openTool = tools.result.tools.find((t) => t.name === "open_mission_control");
  const resourceUri = openTool._meta?.ui?.resourceUri;
  assert(typeof resourceUri === "string", "dashboard tool declares its UI resource");

  const resource = await request("resources/read", { uri: resourceUri });
  const html = resource.result?.contents?.[0]?.text ?? "";
  assert(html.includes("<!doctype html>") && html.includes("<script"), "dashboard HTML served");
  assert(!/<script[^>]+src=/.test(html), "dashboard HTML is self-contained");

  const created = await request("tools/call", {
    name: "create_project",
    arguments: { name: "Smoke Test" },
  });
  assert(created.result?.structuredContent?.ok === true, "create_project succeeds");

  const diagnostics = await request("tools/call", { name: "get_diagnostics", arguments: {} });
  const diag = diagnostics.result?.structuredContent?.diagnostics;
  assert(diag?.storageWritable === true, "storage writable");
  assert(diag?.appliedMigrations === diag?.expectedMigrations, "schema fully migrated");
  assert(diag?.dashboard?.available === true, "diagnostics sees the dashboard");

  const state = await request("tools/call", { name: "get_mission_control_state", arguments: {} });
  const timeline = state.result?.structuredContent?.state?.timeline ?? [];
  assert(
    timeline.length === 1 && timeline[0].toolName === "create_project",
    "activity event persisted",
  );

  console.log("Bundle smoke test passed.");
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await exited;
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // Windows may briefly hold the SQLite file; the OS temp cleaner takes over.
  }
  process.exit(0);
} catch (error) {
  console.error("SMOKE FAIL:", error);
  console.error(stderrLines.join(""));
  child.kill();
  process.exit(1);
}
