// Assembles dist/bundle/ so `mcpb pack` can zip it into a .mcpb file.
// Layout:
//   dist/bundle/manifest.json      extension manifest
//   dist/bundle/server/index.js    esbuild-bundled server (written by build:server)
//   dist/bundle/ui/mcp-app.html    vite single-file UI (built by build:ui)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundleDir = path.join(root, "dist", "bundle");

const serverJs = path.join(bundleDir, "server", "index.js");
if (!fs.existsSync(serverJs)) {
  console.error("dist/bundle/server/index.js is missing. Run `npm run build:server` first.");
  process.exit(1);
}

const uiHtml = path.join(root, "dist", "ui", "mcp-app.html");
if (!fs.existsSync(uiHtml)) {
  console.error("dist/ui/mcp-app.html is missing. Run `npm run build:ui` first.");
  process.exit(1);
}

fs.mkdirSync(path.join(bundleDir, "ui"), { recursive: true });
fs.copyFileSync(uiHtml, path.join(bundleDir, "ui", "mcp-app.html"));
fs.copyFileSync(path.join(root, "manifest.json"), path.join(bundleDir, "manifest.json"));

// The server is bundled as CommonJS. Without this, the bundle would inherit
// "type": "module" from poc/package.json when run from inside the repo.
fs.writeFileSync(
  path.join(bundleDir, "package.json"),
  JSON.stringify({ name: "claude-mission-control-poc-bundle", type: "commonjs", private: true }, null, 2),
);

console.log(`Bundle assembled at ${bundleDir}`);
