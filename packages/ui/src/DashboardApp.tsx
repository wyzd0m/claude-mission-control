import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardState, ProjectStage, Task, TaskStatus } from "@mission-control/domain";
import type { HostBridge, ToolError } from "./bridge.js";
import { ProjectHeader } from "./components/ProjectHeader.js";
import { ActivityPanel } from "./components/ActivityPanel.js";
import { WorkPanel } from "./components/WorkPanel.js";
import { FacilityPanel } from "./facility/FacilityPanel.js";
import { createTestBridge } from "./test-bridge.js";

// The conventional dashboard (Phase 5). Renders the read-only DashboardState
// projection and performs actions exclusively through Mission Control tools.
// Errors are shown verbatim with their stable code and recovery hint — never
// hidden behind visual effects.

export function DashboardApp({
  bridge,
  readOnly = false,
}: {
  bridge: HostBridge;
  /** Monitor mode: state renders live, but all mutating controls are off. */
  readOnly?: boolean;
}) {
  const [state, setState] = useState<DashboardState | null>(null);
  const [error, setError] = useState<ToolError | null>(null);
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<{ connected: boolean; detail?: string }>({
    connected: false,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    bridge.onInitialState((initial) => {
      if (mounted.current) setState(initial);
    });
    // Push updates (D-032): sources with a push channel (monitor SSE)
    // deliver fresh state the moment something changes; polling continues
    // below as the correctness baseline.
    bridge.onStateUpdate?.((pushed) => {
      if (mounted.current) setState(pushed);
    });
    bridge.onConnection((status) => {
      if (mounted.current) setConnection(status);
      // Fetch state on connect in case the host did not push an initial
      // tool result (e.g. the dashboard was reloaded in place).
      if (status.connected) {
        void bridge.callTool("get_mission_control_state").then((response) => {
          if (mounted.current && response.ok && response.state !== undefined) {
            setState(response.state as DashboardState);
          }
        });
      }
    });
    return () => {
      mounted.current = false;
    };
  }, [bridge]);

  const refresh = useCallback(async () => {
    const response = await bridge.callTool("get_mission_control_state");
    if (!mounted.current) return;
    if (response.ok) {
      setState(response.state as DashboardState);
    } else {
      setError(response.error);
    }
  }, [bridge]);

  // Live updates (Phase 7, decision D-024): poll the read model on a light
  // interval so events from the conversation appear without user action.
  // State reads create no activity events (D-022) and pause while hidden.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 2500);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Animation test mode (D-031): while enabled, the facility and activity
  // feed render a synthetic event treadmill from the local test bridge (the
  // same one behind `?test`), clearly bannered. Real state keeps polling in
  // the background so unticking snaps straight back.
  const [animationTest, setAnimationTest] = useState(false);
  const [testState, setTestState] = useState<DashboardState | null>(null);
  useEffect(() => {
    if (!animationTest) {
      setTestState(null);
      return;
    }
    const testBridge = createTestBridge();
    let alive = true;
    const pull = () =>
      void testBridge.callTool("get_mission_control_state").then((response) => {
        if (alive && response.ok && response.state !== undefined) {
          setTestState(response.state as DashboardState);
        }
      });
    pull();
    const id = window.setInterval(pull, 2500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [animationTest]);

  /** Run a mutating tool, then refresh the read model. */
  const act = useCallback(
    async (name: string, args: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      const response = await bridge.callTool(name, args);
      if (!mounted.current) return;
      if (!response.ok) {
        setError(response.error);
      }
      await refresh();
      if (mounted.current) setBusy(false);
    },
    [bridge, refresh],
  );

  if (state === null) {
    return (
      <div className="app">
        <div className="panel">
          <p className="muted" style={{ margin: 0 }} aria-live="polite">
            {connection.connected
              ? "Waiting for Mission Control state…"
              : "Connecting to Claude Desktop…"}
          </p>
          {connection.detail && (
            <p className="muted">
              The host connection failed: {connection.detail}. Reload the dashboard or reopen it
              from the conversation.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <ProjectHeader
        state={state}
        busy={busy}
        readOnly={readOnly}
        onSelectProject={(projectId) => void act("set_active_project", { projectId })}
        onChangeStage={(stage: ProjectStage) => void act("update_project_stage", { stage })}
        onRefresh={() => void refresh()}
      />

      {readOnly && (
        <div className="panel monitor-banner" role="note">
          <strong>Monitor mode</strong> — read-only view. Make changes in your Claude conversation;
          they appear here automatically.
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <strong>{error.code}</strong>: {error.message}{" "}
          <span className="muted">Recovery: {error.recovery}</span>
          {error.correlationId && (
            <span className="muted"> (correlation {error.correlationId})</span>
          )}
          <button type="button" style={{ marginLeft: 8 }} onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="main">
        <div className="column">
          <FacilityPanel
            state={animationTest && testState !== null ? testState : state}
            animationTest={animationTest}
            onAnimationTest={setAnimationTest}
          />
          <ActivityPanel
            current={(animationTest && testState !== null ? testState : state).currentActivity}
            timeline={(animationTest && testState !== null ? testState : state).timeline}
            busy={busy}
            // Dashboard approvals (D-033) act on real pending operations, so
            // they are absent in read-only monitor mode and while the
            // synthetic animation test feed is showing.
            onApprove={
              readOnly || animationTest
                ? undefined
                : (eventId) => void act("approve_pending_operation", { eventId })
            }
            onReject={
              readOnly || animationTest
                ? undefined
                : (eventId) => void act("reject_pending_operation", { eventId })
            }
          />
        </div>
        <div className="column">
          <WorkPanel
            state={state}
            busy={busy}
            readOnly={readOnly}
            connection={connection}
            onCreateTask={(title) => void act("create_task", { title })}
            onTaskStatus={(task: Task, status: TaskStatus, blockedReason?: string) =>
              void act("update_task", {
                taskId: task.id,
                status,
                ...(blockedReason !== undefined ? { blockedReason } : {}),
              })
            }
            onSaveCheckpoint={(summary, nextAction) =>
              void act("save_checkpoint", {
                summary,
                ...(nextAction !== "" ? { recommendedNextAction: nextAction } : {}),
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
