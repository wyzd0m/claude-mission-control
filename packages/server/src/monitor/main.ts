import { spawn } from "node:child_process";
import { isDomainError } from "@mission-control/domain";
import { resolveDashboardHtmlPath } from "../mcp/ui-resource.js";
import { databaseFilePath } from "../storage/paths.js";
import { startMonitorServer } from "./monitor-server.js";

// CLI entry for the standalone monitor: `npm run monitor`.
// Options via environment:
//   CMC_MONITOR_PORT     port (default 8642)
//   CMC_MONITOR_NO_OPEN  set to skip auto-opening the browser

function openInBrowser(url: string): void {
  const platform = process.platform;
  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

async function main() {
  // Fail fast with the recovery hint if the dashboard is not built.
  resolveDashboardHtmlPath();

  const portRaw = process.env.CMC_MONITOR_PORT;
  const port = portRaw !== undefined && portRaw.trim() !== "" ? Number(portRaw) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) {
    console.error(`[monitor] invalid CMC_MONITOR_PORT: ${portRaw}`);
    process.exit(1);
  }

  const monitor = await startMonitorServer(port !== undefined ? { port } : {});
  console.error(`[monitor] Mission Control monitor at ${monitor.url}`);
  console.error(`[monitor] reading ${databaseFilePath()} (read-only view; Ctrl+C to stop)`);
  if (process.env.CMC_MONITOR_NO_OPEN === undefined && !process.argv.includes("--no-open")) {
    openInBrowser(monitor.url);
  }

  const shutdown = () => {
    void monitor.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  if (isDomainError(error)) {
    console.error(`[monitor] ${error.code}: ${error.message} ${error.recovery}`);
  } else {
    console.error("[monitor] fatal startup error", error);
  }
  process.exit(1);
});
