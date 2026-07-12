import { App } from "@modelcontextprotocol/ext-apps";
import type { DashboardState } from "@mission-control/domain";

// The dashboard's only connection to the outside world. Components receive a
// HostBridge; the real implementation talks to the MCP Apps host, and tests
// inject a fake. The UI never touches storage or transports directly
// (docs/SYSTEM_ARCHITECTURE.md).

export interface ToolError {
  code: string;
  message: string;
  recovery: string;
  correlationId?: string;
}

export type ToolResponse =
  ({ ok: true } & Record<string, unknown>) | { ok: false; error: ToolError };

export interface HostBridge {
  /** Resolves with the tool's structured result; never rejects for tool errors. */
  callTool(name: string, args?: Record<string, unknown>): Promise<ToolResponse>;
  /** Fires when the host pushes the initial open_mission_control result. */
  onInitialState(listener: (state: DashboardState) => void): void;
  /** Fires when the connection to the host is established or fails. */
  onConnection(listener: (status: { connected: boolean; detail?: string }) => void): void;
  /**
   * Optional push channel (D-032): fires whenever the source publishes a
   * fresh read model on its own (e.g. the monitor's SSE stream). Sources
   * without push simply omit it — polling remains the correctness baseline.
   */
  onStateUpdate?(listener: (state: DashboardState) => void): void;
}

function toToolResponse(structured: unknown): ToolResponse {
  if (structured !== null && typeof structured === "object" && "ok" in structured) {
    return structured as ToolResponse;
  }
  return {
    ok: false,
    error: {
      code: "HOST_RESULT_MISSING",
      message: "The host returned a result without structured content.",
      recovery: "Retry the action; if it keeps failing, reload the dashboard.",
    },
  };
}

export function createExtAppsBridge(): HostBridge {
  const app = new App({ name: "Claude Mission Control", version: "0.2.0" });
  const stateListeners: Array<(state: DashboardState) => void> = [];
  const connectionListeners: Array<(status: { connected: boolean; detail?: string }) => void> = [];

  app.ontoolresult = (result) => {
    const structured = (result as { structuredContent?: unknown }).structuredContent;
    const response = toToolResponse(structured);
    if (response.ok && response.state !== undefined) {
      for (const listener of stateListeners) {
        listener(response.state as DashboardState);
      }
    }
  };

  app
    .connect()
    .then(() => {
      for (const listener of connectionListeners) listener({ connected: true });
    })
    .catch((error: unknown) => {
      for (const listener of connectionListeners) {
        listener({
          connected: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    });

  return {
    async callTool(name, args = {}) {
      try {
        const result = await app.callServerTool({ name, arguments: args });
        return toToolResponse((result as { structuredContent?: unknown }).structuredContent);
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "HOST_CALL_FAILED",
            message: error instanceof Error ? error.message : String(error),
            recovery: "Retry the action; if it keeps failing, reload the dashboard.",
          },
        };
      }
    },
    onInitialState(listener) {
      stateListeners.push(listener);
    },
    onConnection(listener) {
      connectionListeners.push(listener);
    },
  };
}
