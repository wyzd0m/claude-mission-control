import { PROJECT_STAGES, type DashboardState, type ProjectStage } from "@mission-control/domain";
import { STAGE_LABELS } from "../stage-labels.js";

interface Props {
  state: DashboardState;
  busy: boolean;
  onSelectProject: (projectId: string) => void;
  onChangeStage: (stage: ProjectStage) => void;
  onRefresh: () => void;
}

export function ProjectHeader({ state, busy, onSelectProject, onChangeStage, onRefresh }: Props) {
  const { activeProject, projects, projectProgress } = state;
  return (
    <header className="panel header">
      <h1>Claude Mission Control</h1>

      <label className="row">
        <span className="muted">Project</span>
        <select
          aria-label="Active project"
          value={state.activeProjectId ?? ""}
          disabled={busy || projects.length === 0}
          onChange={(e) => {
            if (e.target.value !== "") onSelectProject(e.target.value);
          }}
        >
          {projects.length === 0 && <option value="">No projects yet</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.status === "archived" ? " (archived)" : ""}
            </option>
          ))}
        </select>
      </label>

      {activeProject && (
        <>
          <nav aria-label="Project stage" className="stage-bar">
            {PROJECT_STAGES.map((stage) => (
              <span
                key={stage}
                className="stage-chip"
                aria-current={activeProject.currentStage === stage ? "step" : undefined}
              >
                {STAGE_LABELS[stage]}
              </span>
            ))}
          </nav>
          <label className="row">
            <span className="muted">Set stage</span>
            <select
              aria-label="Change project stage"
              value={activeProject.currentStage}
              disabled={busy}
              onChange={(e) => onChangeStage(e.target.value as ProjectStage)}
            >
              {PROJECT_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </label>
          {projectProgress && projectProgress.totalTasks > 0 && (
            <span className="muted">
              Task completion: {projectProgress.doneTasks} of {projectProgress.totalTasks} tasks
              done
            </span>
          )}
        </>
      )}

      <button type="button" onClick={onRefresh} disabled={busy} style={{ marginLeft: "auto" }}>
        Refresh
      </button>
    </header>
  );
}
