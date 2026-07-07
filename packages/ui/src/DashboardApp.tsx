import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardState, ProjectStage, Task, TaskStatus } from "@mission-control/domain";
import type { HostBridge, ToolError } from "./bridge.js";
import { ProjectHeader } from "./components/ProjectHeader.js";
import { ActivityPanel } from "./components/ActivityPanel.js";
import { WorkPanel } from "./components/WorkPanel.js";

// The conventional dashboard (Phase 5). Renders the read-only DashboardState
// projection and performs actions exclusively through Mission Control tools.
// Errors are shown verbatim with their stable code and recovery hint — never
// hidden behind visual effects.

export function DashboardApp({ bridge }: { bridge: HostBridge }) {
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
    bridge.onConnection((status) => {
      if (mounted.current) setConnection(status);
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
        onSelectProject={(projectId) => void act("set_active_project", { projectId })}
        onChangeStage={(stage: ProjectStage) => void act("update_project_stage", { stage })}
        onRefresh={() => void refresh()}
      />

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
          <ActivityPanel current={state.currentActivity} timeline={state.timeline} />
        </div>
        <div className="column">
          <WorkPanel
            state={state}
            busy={busy}
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
