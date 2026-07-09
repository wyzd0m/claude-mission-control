import { spawn } from "node:child_process";
import { isDomainError } from "@mission-control/domain";
import { resolveDashboardHtmlPath } from "../mcp/ui-resource.js";
import { databaseFilePath } from "../storage/paths.js";
import {
  DEFAULT_MONITOR_PORT,
  monitorAlreadyRunningAt,
  startMonitorServer,
  type MonitorServer,
} from "./monitor-server.js";

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

  // `--port <n>` (dev launch configs use 8643 so they never squat the real
  // monitor's canonical 8642) takes precedence over CMC_MONITOR_PORT.
  const portFlagIndex = process.argv.indexOf("--port");
  const portRaw =
    portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : process.env.CMC_MONITOR_PORT;
  const port = portRaw !== undefined && portRaw.trim() !== "" ? Number(portRaw) : undefined;
  if (
    (portFlagIndex >= 0 || port !== undefined) &&
    (port === undefined || !Number.isInteger(port) || port < 0 || port > 65535)
  ) {
    console.error(`[monitor] invalid port: ${portRaw}`);
    process.exit(1);
  }

  const shouldOpen =
    process.env.CMC_MONITOR_NO_OPEN === undefined && !process.argv.includes("--no-open");

  let monitor: MonitorServer;
  try {
    monitor = await startMonitorServer(port !== undefined ? { port } : {});
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      const requestedPort = port ?? DEFAULT_MONITOR_PORT;
      const url = `http://127.0.0.1:${requestedPort}/?monitor`;
      if (await monitorAlreadyRunningAt(requestedPort)) {
        console.error(`[monitor] A monitor is already running at ${url}`);
        console.error(`[monitor] Opening the existing one instead of starting a second copy.`);
        if (shouldOpen) openInBrowser(url);
        return;
      }
      console.error(
        `[monitor] Port ${requestedPort} is in use by another application. ` +
          `Set CMC_MONITOR_PORT to a free port and run the monitor again.`,
      );
      process.exit(1);
    }
    throw error;
  }
  console.error(`[monitor] Mission Control monitor at ${monitor.url}`);
  console.error(`[monitor] reading ${databaseFilePath()} (read-only view; Ctrl+C to stop)`);
  if (shouldOpen) {
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
