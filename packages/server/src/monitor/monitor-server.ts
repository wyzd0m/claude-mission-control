import http from "node:http";
import { isDomainError } from "@mission-control/domain";
import { openDatabase } from "../storage/database.js";
import { databaseFilePath } from "../storage/paths.js";
import { createServiceContext } from "../services/service-context.js";
import { createActivityEventService } from "../services/activity-event-service.js";
import { createUiStateService } from "../services/ui-state-service.js";
import { readDashboardHtml } from "../mcp/ui-resource.js";
import { SERVER_VERSION } from "../mcp/server.js";

// Standalone monitor (decision D-025): a local, read-only window onto the
// Mission Control database, independent of Claude Desktop's MCP server
// lifecycle. It serves the existing dashboard plus a /state endpoint on
// 127.0.0.1 only. It never mutates project data and never reconciles
// orphaned events — the extension owns lifecycle writes; the monitor only
// observes. Exposed as an embeddable function so a future native shell
// (tray app / always-on-top window) can wrap it without changes.

export const DEFAULT_MONITOR_PORT = 8642;

export interface MonitorServerOptions {
  /** TCP port; 0 picks a free port. Default 8642. */
  port?: number;
  /** Database path override (tests); defaults to the shared local database. */
  dbPath?: string;
}

export interface MonitorServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

/**
 * True when a healthy Mission Control monitor already answers on `port`.
 * Lets launchers open the existing window instead of failing with
 * EADDRINUSE when the monitor is started twice.
 */
export async function monitorAlreadyRunningAt(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
} as const;

export function startMonitorServer(options: MonitorServerOptions = {}): Promise<MonitorServer> {
  const dbPath = options.dbPath ?? databaseFilePath();
  const { db } = openDatabase(dbPath);
  const ctx = createServiceContext(db);
  const activity = createActivityEventService(ctx);
  const uiState = createUiStateService(ctx, activity, SERVER_VERSION);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && url.pathname === "/state") {
        const state = uiState.buildDashboardState();
        res.writeHead(200, JSON_HEADERS);
        res.end(JSON.stringify({ ok: true, state }));
        return;
      }
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        });
        res.end(readDashboardHtml());
        return;
      }
      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, JSON_HEADERS);
        // databasePath makes a wrong-data-directory monitor diagnosable at
        // a glance (e.g. a sandboxed dev instance squatting the port).
        res.end(JSON.stringify({ ok: true, serverVersion: SERVER_VERSION, databasePath: dbPath }));
        return;
      }
      res.writeHead(404, JSON_HEADERS);
      res.end(
        JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: "Unknown path." } }),
      );
    } catch (error) {
      const payload = isDomainError(error)
        ? { code: error.code, message: error.message, recovery: error.recovery }
        : { code: "UNEXPECTED_INTERNAL_ERROR", message: "The monitor hit an unexpected error." };
      res.writeHead(500, JSON_HEADERS);
      res.end(JSON.stringify({ ok: false, error: payload }));
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // 127.0.0.1 only: the monitor is never reachable from the network.
    server.listen(options.port ?? DEFAULT_MONITOR_PORT, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resolve({
        port,
        url: `http://127.0.0.1:${port}/?monitor`,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((error) => {
              db.close();
              if (error) rejectClose(error);
              else resolveClose();
            });
          }),
      });
    });
  });
}
