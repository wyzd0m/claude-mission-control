import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DomainError } from "@mission-control/domain";

// Resolution of the built single-file dashboard HTML.
// Order: explicit override (CMC_UI_HTML) -> repository dev build.
// Phase 9 packaging will ship the file inside the bundle and point the
// override at it via the manifest.

export const DASHBOARD_RESOURCE_URI = "ui://claude-mission-control/dashboard.html";

export function resolveDashboardHtmlPath(): string {
  const unavailable = (detail: string) =>
    new DomainError(
      "UI_RESOURCE_UNAVAILABLE",
      `The dashboard interface file is not available (${detail}).`,
      "Build the dashboard with `npm run build:dashboard`, or set CMC_UI_HTML to the built file.",
    );

  // An explicit override never falls back: a misconfigured path should
  // surface as an error, not silently serve a different build.
  const override = process.env.CMC_UI_HTML;
  if (override && override.trim() !== "") {
    const resolved = path.resolve(override);
    if (!fs.existsSync(resolved)) {
      throw unavailable(`CMC_UI_HTML points to a missing file: ${resolved}`);
    }
    return resolved;
  }

  // In the packaged bundle the server is compiled to CommonJS and __dirname
  // exists; in the ESM dev build we derive it from import.meta.
  const here =
    typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    // Extension bundle layout: <bundle>/server/index.js -> <bundle>/ui/dashboard.html
    path.resolve(here, "..", "ui", "dashboard.html"),
    // Repository dev layout: packages/server/{src,dist}/mcp -> packages/ui/dist/dashboard.html
    path.resolve(here, "..", "..", "..", "ui", "dist", "dashboard.html"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw unavailable(`no built dashboard at ${candidates.join(" or ")}`);
}

export function readDashboardHtml(): string {
  return fs.readFileSync(resolveDashboardHtmlPath(), "utf-8");
}
