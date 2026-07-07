// Monitor bridge tests (D-025): state reads go to /state, everything
// mutating is refused as read-only, and a dead monitor process reports a
// clear disconnected error.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMonitorBridge } from "./monitor-bridge.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: () => Promise<Response>) {
  const spy = vi.fn(response);
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("monitor bridge", () => {
  it("fetches state from /state", async () => {
    const spy = stubFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, state: { generatedAt: "now" } }), {
          status: 200,
        }),
      ),
    );
    const bridge = createMonitorBridge();
    const response = await bridge.callTool("get_mission_control_state");
    expect(response.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith("/state", { cache: "no-store" });
  });

  it("refuses every mutating tool as read-only", async () => {
    stubFetch(() => Promise.reject(new Error("must not be called")));
    const bridge = createMonitorBridge();
    for (const name of ["create_task", "update_project_stage", "apply_bulk_task_update"]) {
      const response = await bridge.callTool(name, { any: "args" });
      expect(response.ok).toBe(false);
      if (!response.ok) {
        expect(response.error.code).toBe("MONITOR_READ_ONLY");
        expect(response.error.recovery).toMatch(/conversation/);
      }
    }
  });

  it("reports a disconnected monitor with a recovery hint", async () => {
    stubFetch(() => Promise.reject(new Error("connection refused")));
    const bridge = createMonitorBridge();
    const response = await bridge.callTool("get_mission_control_state");
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe("MONITOR_DISCONNECTED");
      expect(response.error.recovery).toMatch(/npm run monitor/);
    }
  });

  it("pushes the initial state and connection status", async () => {
    stubFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, state: { generatedAt: "now" } }), {
          status: 200,
        }),
      ),
    );
    const bridge = createMonitorBridge();
    const state = await new Promise((resolve) => bridge.onInitialState(resolve));
    expect(state).toMatchObject({ generatedAt: "now" });
    const connection = await new Promise<{ connected: boolean }>((resolve) =>
      bridge.onConnection(resolve),
    );
    expect(connection.connected).toBe(true);
  });
});
