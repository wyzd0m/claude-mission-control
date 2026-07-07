import { useId, useState } from "react";
import {
  TASK_STATUSES,
  type DashboardState,
  type Task,
  type TaskStatus,
} from "@mission-control/domain";
import { formatDateTime } from "../format.js";
import { STAGE_LABELS } from "../stage-labels.js";

type Tab = "tasks" | "decisions" | "checkpoint" | "diagnostics";

interface Props {
  state: DashboardState;
  busy: boolean;
  readOnly?: boolean;
  connection: { connected: boolean; detail?: string };
  onCreateTask: (title: string) => void;
  onTaskStatus: (task: Task, status: TaskStatus, blockedReason?: string) => void;
  onSaveCheckpoint: (summary: string, nextAction: string) => void;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "tasks", label: "Tasks" },
  { id: "decisions", label: "Decisions" },
  { id: "checkpoint", label: "Checkpoint" },
  { id: "diagnostics", label: "Diagnostics" },
];

function TasksTab({ state, busy, readOnly, onCreateTask, onTaskStatus }: Props) {
  const [title, setTitle] = useState("");
  const inputId = useId();
  if (!state.activeProject) {
    return <p className="muted">Create a project to start tracking tasks.</p>;
  }
  return (
    <>
      {!readOnly && (
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = title.trim();
            if (trimmed !== "") {
              onCreateTask(trimmed);
              setTitle("");
            }
          }}
        >
          <label htmlFor={inputId} className="muted">
            New task
          </label>
          <input
            id={inputId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Task title"
            disabled={busy}
          />
          <button type="submit" disabled={busy || title.trim() === ""}>
            Add task
          </button>
        </form>
      )}

      {state.tasks.length === 0 ? (
        <p className="muted">No tasks yet.</p>
      ) : (
        <table className="tasks">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Stage</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {state.tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  {task.title}
                  {task.blockedReason && <div className="muted">Blocked: {task.blockedReason}</div>}
                </td>
                <td>{STAGE_LABELS[task.stage]}</td>
                <td>{task.priority}</td>
                <td>
                  {readOnly ? (
                    <span>{task.status.replace(/_/g, " ")}</span>
                  ) : (
                    <select
                      aria-label={`Status of task ${task.title}`}
                      value={task.status}
                      disabled={busy}
                      onChange={(e) => {
                        const status = e.target.value as TaskStatus;
                        if (status === "blocked") {
                          const reason = window.prompt("Why is this task blocked?");
                          if (reason && reason.trim() !== "") {
                            onTaskStatus(task, status, reason.trim());
                          }
                        } else {
                          onTaskStatus(task, status);
                        }
                      }}
                    >
                      {TASK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function DecisionsTab({ state }: Props) {
  if (state.decisions.length === 0) {
    return <p className="muted">No decisions recorded yet. Ask Claude to record one.</p>;
  }
  return (
    <ul className="event-list">
      {state.decisions
        .slice()
        .reverse()
        .map((decision) => (
          <li key={decision.id} className="event-row">
            <div>{decision.summary}</div>
            <div className="event-meta">{decision.rationale}</div>
            {decision.alternativesConsidered.length > 0 && (
              <div className="event-meta">
                Alternatives: {decision.alternativesConsidered.join("; ")}
              </div>
            )}
            <div className="event-meta">{formatDateTime(decision.createdAt)}</div>
          </li>
        ))}
    </ul>
  );
}

function CheckpointTab({ state, busy, readOnly, onSaveCheckpoint }: Props) {
  const [summary, setSummary] = useState("");
  const [nextAction, setNextAction] = useState("");
  const summaryId = useId();
  const nextId = useId();
  const checkpoint = state.latestCheckpoint;
  return (
    <>
      {checkpoint ? (
        <div className="event-row" style={{ marginBottom: 10 }}>
          <div>{checkpoint.summary}</div>
          {checkpoint.completedWork.length > 0 && (
            <div className="event-meta">Completed: {checkpoint.completedWork.join("; ")}</div>
          )}
          {checkpoint.openWork.length > 0 && (
            <div className="event-meta">Open: {checkpoint.openWork.join("; ")}</div>
          )}
          {checkpoint.blockers.length > 0 && (
            <div className="event-meta">Blockers: {checkpoint.blockers.join("; ")}</div>
          )}
          {checkpoint.recommendedNextAction !== "" && (
            <div className="event-meta">Next: {checkpoint.recommendedNextAction}</div>
          )}
          <div className="event-meta">Saved {formatDateTime(checkpoint.createdAt)}</div>
        </div>
      ) : (
        <p className="muted">No checkpoint saved for this project yet.</p>
      )}

      {state.activeProject && !readOnly && (
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (summary.trim() !== "") {
              onSaveCheckpoint(summary.trim(), nextAction.trim());
              setSummary("");
              setNextAction("");
            }
          }}
        >
          <label htmlFor={summaryId} className="muted">
            Summary
          </label>
          <input
            id={summaryId}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={120}
            disabled={busy}
          />
          <label htmlFor={nextId} className="muted">
            Next action
          </label>
          <input
            id={nextId}
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            maxLength={500}
            disabled={busy}
          />
          <button type="submit" disabled={busy || summary.trim() === ""}>
            Save checkpoint
          </button>
        </form>
      )}
    </>
  );
}

function DiagnosticsTab({ state, connection }: Props) {
  return (
    <ul className="event-list">
      <li className="event-row">
        Host connection:{" "}
        <span className={connection.connected ? "status-succeeded" : "status-failed"}>
          {connection.connected ? "connected" : "not connected"}
        </span>
        {connection.detail && <div className="event-meta">{connection.detail}</div>}
      </li>
      <li className="event-row">Server version: {state.serverVersion}</li>
      <li className="event-row">State generated: {formatDateTime(state.generatedAt)}</li>
      <li className="event-row">
        Projects: {state.projects.length} · Events in view: {state.timeline.length}
      </li>
      <li className="event-row event-meta">
        Mission Control shows only its own saved records and observable tool events. It has no
        access to Claude&apos;s reasoning or conversations.
      </li>
    </ul>
  );
}

export function WorkPanel(props: Props) {
  const [tab, setTab] = useState<Tab>("tasks");
  return (
    <section className="panel" aria-label="Project records" style={{ flex: 1 }}>
      <div role="tablist" className="tabs" aria-label="Project record views">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === "tasks" && <TasksTab {...props} />}
        {tab === "decisions" && <DecisionsTab {...props} />}
        {tab === "checkpoint" && <CheckpointTab {...props} />}
        {tab === "diagnostics" && <DiagnosticsTab {...props} />}
      </div>
    </section>
  );
}
