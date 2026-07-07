import type { DashboardState } from "@mission-control/domain";
import type { HostBridge, ToolResponse } from "./bridge.js";

// Bridge for the standalone monitor window (D-025): the dashboard is served
// by the local monitor process and reads state from its /state endpoint on
// the same origin (127.0.0.1). The monitor is strictly read-only — every
// mutating tool call is refused with a hint to act in the conversation.

const READ_ONLY_RESPONSE: ToolResponse = {
  ok: false,
  error: {
    code: "MONITOR_READ_ONLY",
    message: "The monitor window is a read-only view.",
    recovery: "Make changes in your Claude conversation; they appear here within seconds.",
  },
};

async function fetchState(): Promise<ToolResponse> {
  try {
    const response = await fetch("/state", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as ToolResponse;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "MONITOR_DISCONNECTED",
        message: `The monitor process is not reachable (${error instanceof Error ? error.message : String(error)}).`,
        recovery: "Check that the monitor is running (npm run monitor), then reload this page.",
      },
    };
  }
}

export function createMonitorBridge(): HostBridge {
  return {
    callTool(name) {
      if (name === "get_mission_control_state") {
        return fetchState();
      }
      return Promise.resolve(READ_ONLY_RESPONSE);
    },
    onInitialState(listener) {
      void fetchState().then((response) => {
        if (response.ok && response.state !== undefined) {
          listener(response.state as DashboardState);
        }
      });
    },
    onConnection(listener) {
      void fetchState().then((response) => {
        if (response.ok) {
          listener({
            connected: true,
            detail: "Monitor mode: read-only local view served from 127.0.0.1.",
          });
        } else {
          listener({ connected: false, detail: response.error.message });
        }
      });
    },
  };
}
