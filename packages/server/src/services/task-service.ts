import {
  createTask,
  updateTask,
  DomainError,
  type CreateTaskInput,
  type Task,
  type TaskFilter,
  type UpdateTaskInput,
} from "@mission-control/domain";
import { withTransaction } from "../storage/database.js";
import { hashApprovalPayload } from "./approval-service.js";
import { requireProject, type ServiceContext } from "./service-context.js";

const BULK_APPROVAL_KIND = "bulk_task_update";

export interface BulkUpdateRequest {
  projectId: string;
  filter: TaskFilter;
  changes: UpdateTaskInput;
}

export interface BulkUpdatePreview {
  projectId: string;
  affected: Array<{ id: string; title: string; revision: number }>;
  changes: UpdateTaskInput;
  confirmationToken: string;
  expiresAt: string;
}

function bulkPayload(
  request: BulkUpdateRequest,
  affected: Array<{ id: string; revision: number }>,
) {
  // The token binds the exact affected tasks at their exact revisions, so an
  // approval cannot silently apply to different or newer data.
  return { request, affected };
}

export function createTaskService(ctx: ServiceContext) {
  const deps = { now: ctx.now };

  function requireTask(taskId: string): Task {
    const task = ctx.tasks.getById(taskId);
    if (task === null) {
      throw new DomainError(
        "TASK_NOT_FOUND",
        "The task was not found.",
        "List tasks with list_tasks to find the right id.",
      );
    }
    return task;
  }

  return {
    create(input: Omit<CreateTaskInput, "projectId"> & { projectId?: string | undefined }): Task {
      const project = requireProject(ctx, input.projectId);
      if (input.parentTaskId != null) {
        const parent = requireTask(input.parentTaskId);
        if (parent.projectId !== project.id) {
          throw new DomainError(
            "VALIDATION_FAILED",
            "The parent task belongs to a different project.",
            "Choose a parent task from the same project.",
          );
        }
      }
      const task = createTask({ ...input, projectId: project.id }, deps);
      ctx.tasks.insert(task);
      return task;
    },

    update(taskId: string, changes: UpdateTaskInput): Task {
      const task = requireTask(taskId);
      if (changes.parentTaskId != null) {
        const parent = requireTask(changes.parentTaskId);
        if (parent.projectId !== task.projectId) {
          throw new DomainError(
            "VALIDATION_FAILED",
            "The parent task belongs to a different project.",
            "Choose a parent task from the same project.",
          );
        }
      }
      const updated = updateTask(task, changes, deps);
      ctx.tasks.update(updated);
      return updated;
    },

    get: requireTask,

    list(projectId?: string, filter?: TaskFilter): Task[] {
      const project = requireProject(ctx, projectId);
      return ctx.tasks.listByProject(project.id, filter);
    },

    /** Dry-run of a bulk change. Applies domain rules to copies; writes nothing. */
    previewBulkUpdate(request: {
      projectId?: string | undefined;
      filter: TaskFilter;
      changes: UpdateTaskInput;
    }): BulkUpdatePreview {
      const project = requireProject(ctx, request.projectId);
      const targets = ctx.tasks.listByProject(project.id, request.filter);
      if (targets.length === 0) {
        throw new DomainError(
          "VALIDATION_FAILED",
          "No tasks match the filter; there is nothing to update.",
          "Adjust the filter or check the project with list_tasks.",
        );
      }
      // Validate that the change is legal for every target before promising it.
      for (const task of targets) {
        updateTask(task, request.changes, deps);
      }
      const fullRequest: BulkUpdateRequest = {
        projectId: project.id,
        filter: request.filter,
        changes: request.changes,
      };
      const affected = targets.map((t) => ({ id: t.id, title: t.title, revision: t.revision }));
      const { token, expiresAt } = ctx.approvals.issue(
        BULK_APPROVAL_KIND,
        hashApprovalPayload(
          bulkPayload(
            fullRequest,
            affected.map(({ id, revision }) => ({ id, revision })),
          ),
        ),
      );
      return {
        projectId: project.id,
        affected,
        changes: request.changes,
        confirmationToken: token,
        expiresAt,
      };
    },

    /** Applies a previously previewed bulk change in one transaction. */
    applyBulkUpdate(request: {
      projectId?: string | undefined;
      filter: TaskFilter;
      changes: UpdateTaskInput;
      affected: Array<{ id: string; revision: number }>;
      confirmationToken: string;
    }): Task[] {
      const project = requireProject(ctx, request.projectId);
      const fullRequest: BulkUpdateRequest = {
        projectId: project.id,
        filter: request.filter,
        changes: request.changes,
      };
      ctx.approvals.consume(
        BULK_APPROVAL_KIND,
        request.confirmationToken,
        hashApprovalPayload(bulkPayload(fullRequest, request.affected)),
      );
      return withTransaction(ctx.db, () => {
        const results: Task[] = [];
        for (const { id, revision } of request.affected) {
          const task = requireTask(id);
          if (task.revision !== revision) {
            throw new DomainError(
              "REVISION_CONFLICT",
              `Task ${id} changed after the preview was created.`,
              "Preview the bulk update again to approve the current state.",
            );
          }
          const updated = updateTask(task, request.changes, deps);
          ctx.tasks.update(updated);
          results.push(updated);
        }
        return results;
      });
    },
  };
}

export type TaskService = ReturnType<typeof createTaskService>;
