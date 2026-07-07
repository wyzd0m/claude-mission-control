import { SETTING_ACTIVE_PROJECT_ID, type DashboardState } from "@mission-control/domain";
import type { ServiceContext } from "./service-context.js";
import type { ActivityEventService } from "./activity-event-service.js";

// UI state projection (docs/SYSTEM_ARCHITECTURE.md): one stable read model
// the dashboard renders from (type: DashboardState in the domain package).
// Everything here comes from saved records and persisted activity events —
// never from assumptions about what Claude is doing.

export type { DashboardState };

const TIMELINE_LIMIT = 50;

export function createUiStateService(
  ctx: ServiceContext,
  activity: ActivityEventService,
  serverVersion: string,
) {
  return {
    buildDashboardState(): DashboardState {
      const activeProjectId = ctx.settings.get(SETTING_ACTIVE_PROJECT_ID);
      const activeProject = activeProjectId !== null ? ctx.projects.getById(activeProjectId) : null;
      const tasks = activeProject !== null ? ctx.tasks.listByProject(activeProject.id) : [];
      return {
        generatedAt: ctx.now().toISOString(),
        serverVersion,
        projects: ctx.projects.list(),
        activeProjectId: activeProject?.id ?? null,
        activeProject,
        projectProgress:
          activeProject !== null
            ? {
                doneTasks: tasks.filter((t) => t.status === "done").length,
                totalTasks: tasks.length,
              }
            : null,
        tasks,
        decisions: activeProject !== null ? ctx.decisions.listByProject(activeProject.id) : [],
        latestCheckpoint:
          activeProject !== null ? ctx.checkpoints.getLatestByProject(activeProject.id) : null,
        currentActivity: activity.getCurrentActivity(),
        timeline: activity.getTimeline(TIMELINE_LIMIT),
      };
    },
  };
}

export type UiStateService = ReturnType<typeof createUiStateService>;
