// Assembles dist/bundle for `mcpb pack` (Phase 9).
// Layout:
//   dist/bundle/manifest.json     extension manifest (from bundle.manifest.json)
//   dist/bundle/package.json      forces CommonJS for the bundled server
//   dist/bundle/server/index.js   esbuild-bundled MCP server (no node_modules)
//   dist/bundle/ui/dashboard.html vite single-file dashboard
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundleDir = path.join(root, "dist", "bundle");

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
}

// 1. Dashboard (vite single file).
run("npm", ["run", "build:dashboard"]);

// 2. Server (esbuild, CommonJS, node:sqlite stays external as a builtin).
fs.rmSync(bundleDir, { recursive: true, force: true });
run("npx", [
  "esbuild",
  "packages/server/src/mcp/main.ts",
  "--bundle",
  "--platform=node",
  "--format=cjs",
  "--target=node22",
  `--outfile=${path.join(bundleDir, "server", "index.js")}`,
  "--log-level=warning",
]);

// 3. Assemble.
fs.mkdirSync(path.join(bundleDir, "ui"), { recursive: true });
fs.copyFileSync(
  path.join(root, "packages", "ui", "dist", "dashboard.html"),
  path.join(bundleDir, "ui", "dashboard.html"),
);
fs.copyFileSync(path.join(root, "bundle.manifest.json"), path.join(bundleDir, "manifest.json"));
fs.writeFileSync(
  path.join(bundleDir, "package.json"),
  JSON.stringify(
    { name: "claude-mission-control-bundle", type: "commonjs", private: true },
    null,
    2,
  ),
);

console.log(`Bundle assembled at ${bundleDir}`);
