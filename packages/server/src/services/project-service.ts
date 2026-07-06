import {
  archiveProject,
  changeProjectStage,
  createProject,
  restoreProject,
  updateProjectDetails,
  SETTING_ACTIVE_PROJECT_ID,
  type CreateProjectInput,
  type Project,
  type ProjectStage,
  type ProjectStatus,
  type ProjectSummary,
  type UpdateProjectInput,
} from "@mission-control/domain";
import { requireProject, type ServiceContext } from "./service-context.js";

export interface ProjectBrief {
  project: Project;
  isActive: boolean;
  taskCounts: Record<string, number>;
  openTaskCount: number;
  blockedTaskCount: number;
  decisionCount: number;
  artifactCount: number;
  checkpointCount: number;
  latestCheckpointSummary: string | null;
}

export function createProjectService(ctx: ServiceContext) {
  const deps = { now: ctx.now };
  return {
    create(input: CreateProjectInput): Project {
      const project = createProject(input, deps);
      ctx.projects.insert(project);
      // The first project becomes active automatically so follow-up tools
      // work without an extra step.
      if (ctx.settings.get(SETTING_ACTIVE_PROJECT_ID) === null) {
        ctx.settings.set(SETTING_ACTIVE_PROJECT_ID, project.id);
      }
      return project;
    },

    list(status?: ProjectStatus): ProjectSummary[] {
      return ctx.projects.list(status);
    },

    getActiveProjectId(): string | null {
      return ctx.settings.get(SETTING_ACTIVE_PROJECT_ID);
    },

    setActive(projectId: string): Project {
      const project = requireProject(ctx, projectId);
      ctx.settings.set(SETTING_ACTIVE_PROJECT_ID, project.id);
      return project;
    },

    updateDetails(changes: UpdateProjectInput, projectId?: string): Project {
      const project = requireProject(ctx, projectId);
      const updated = updateProjectDetails(project, changes, deps);
      ctx.projects.update(updated);
      return updated;
    },

    changeStage(stage: ProjectStage, projectId?: string): Project {
      const project = requireProject(ctx, projectId);
      const updated = changeProjectStage(project, stage, deps);
      ctx.projects.update(updated);
      return updated;
    },

    archive(projectId?: string): Project {
      const project = requireProject(ctx, projectId);
      const updated = archiveProject(project, deps);
      ctx.projects.update(updated);
      if (ctx.settings.get(SETTING_ACTIVE_PROJECT_ID) === project.id) {
        ctx.settings.delete(SETTING_ACTIVE_PROJECT_ID);
      }
      return updated;
    },

    restore(projectId: string): Project {
      const project = requireProject(ctx, projectId);
      const updated = restoreProject(project, deps);
      ctx.projects.update(updated);
      return updated;
    },

    brief(projectId?: string): ProjectBrief {
      const project = requireProject(ctx, projectId);
      const tasks = ctx.tasks.listByProject(project.id);
      const taskCounts: Record<string, number> = {};
      for (const task of tasks) {
        taskCounts[task.status] = (taskCounts[task.status] ?? 0) + 1;
      }
      const latest = ctx.checkpoints.getLatestByProject(project.id);
      return {
        project,
        isActive: ctx.settings.get(SETTING_ACTIVE_PROJECT_ID) === project.id,
        taskCounts,
        openTaskCount: tasks.filter((t) => t.status === "todo" || t.status === "in_progress")
          .length,
        blockedTaskCount: tasks.filter((t) => t.status === "blocked").length,
        decisionCount: ctx.decisions.listByProject(project.id).length,
        artifactCount: ctx.artifacts.listByProject(project.id).length,
        checkpointCount: ctx.checkpoints.listByProject(project.id).length,
        latestCheckpointSummary: latest?.summary ?? null,
      };
    },
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
