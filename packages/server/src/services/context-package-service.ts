import type { Checkpoint, Decision, Task } from "@mission-control/domain";
import { requireProject, type ServiceContext } from "./service-context.js";

// Context package rules (docs/TOOL_AND_EVENT_MODEL.md): selective, includes
// source record IDs, separates facts from recommendations, and never dumps
// full history.

export interface ContextPackage {
  generatedAt: string;
  /** Facts: saved state, verbatim from records. */
  facts: {
    project: {
      id: string;
      name: string;
      goal: string;
      definitionOfDone: string;
      currentStage: string;
      status: string;
    };
    openTasks: Array<Pick<Task, "id" | "title" | "status" | "priority" | "stage">>;
    blockedTasks: Array<Pick<Task, "id" | "title" | "blockedReason">>;
    recentDecisions: Array<Pick<Decision, "id" | "summary" | "rationale" | "createdAt">>;
    latestCheckpoint:
      | (Pick<Checkpoint, "id" | "summary" | "completedWork" | "openWork" | "blockers"> & {
          createdAt: string;
        })
      | null;
  };
  /** Recommendations: derived suggestions, clearly separated from facts. */
  recommendations: {
    nextAction: string | null;
  };
  /** Every record the package was built from. */
  sourceRecordIds: string[];
}

export interface ContextPackageOptions {
  projectId?: string | undefined;
  maxTasks?: number | undefined;
  maxDecisions?: number | undefined;
}

const DEFAULT_MAX_TASKS = 20;
const DEFAULT_MAX_DECISIONS = 10;

export function createContextPackageService(ctx: ServiceContext) {
  return {
    prepare(options: ContextPackageOptions = {}): ContextPackage {
      const project = requireProject(ctx, options.projectId);
      const maxTasks = options.maxTasks ?? DEFAULT_MAX_TASKS;
      const maxDecisions = options.maxDecisions ?? DEFAULT_MAX_DECISIONS;

      const allTasks = ctx.tasks.listByProject(project.id);
      const openTasks = allTasks
        .filter((t) => t.status === "todo" || t.status === "in_progress")
        .slice(0, maxTasks);
      const blockedTasks = allTasks.filter((t) => t.status === "blocked").slice(0, maxTasks);
      const recentDecisions = ctx.decisions.listByProject(project.id).slice(-maxDecisions);
      const latestCheckpoint = ctx.checkpoints.getLatestByProject(project.id);

      const sourceRecordIds = [
        project.id,
        ...openTasks.map((t) => t.id),
        ...blockedTasks.map((t) => t.id),
        ...recentDecisions.map((d) => d.id),
        ...(latestCheckpoint ? [latestCheckpoint.id] : []),
      ];

      return {
        generatedAt: ctx.now().toISOString(),
        facts: {
          project: {
            id: project.id,
            name: project.name,
            goal: project.goal,
            definitionOfDone: project.definitionOfDone,
            currentStage: project.currentStage,
            status: project.status,
          },
          openTasks: openTasks.map(({ id, title, status, priority, stage }) => ({
            id,
            title,
            status,
            priority,
            stage,
          })),
          blockedTasks: blockedTasks.map(({ id, title, blockedReason }) => ({
            id,
            title,
            blockedReason,
          })),
          recentDecisions: recentDecisions.map(({ id, summary, rationale, createdAt }) => ({
            id,
            summary,
            rationale,
            createdAt,
          })),
          latestCheckpoint: latestCheckpoint
            ? {
                id: latestCheckpoint.id,
                summary: latestCheckpoint.summary,
                completedWork: latestCheckpoint.completedWork,
                openWork: latestCheckpoint.openWork,
                blockers: latestCheckpoint.blockers,
                createdAt: latestCheckpoint.createdAt,
              }
            : null,
        },
        recommendations: {
          nextAction:
            latestCheckpoint && latestCheckpoint.recommendedNextAction !== ""
              ? latestCheckpoint.recommendedNextAction
              : null,
        },
        sourceRecordIds,
      };
    },
  };
}

export type ContextPackageService = ReturnType<typeof createContextPackageService>;
