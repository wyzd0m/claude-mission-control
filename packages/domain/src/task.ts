import { z } from "zod";
import {
  idSchema,
  timestampSchema,
  nameSchema,
  longTextSchema,
  shortTextSchema,
  definedProps,
  resolveId,
  resolveNow,
  type DomainDeps,
} from "./common.js";
import { projectStageSchema } from "./project.js";
import { DomainError } from "./errors.js";

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const taskSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  title: nameSchema,
  description: longTextSchema,
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  stage: projectStageSchema,
  blockedReason: shortTextSchema.nullable(),
  parentTaskId: idSchema.nullable(),
  revision: z.number().int().positive(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
});

export type Task = z.infer<typeof taskSchema>;

export const createTaskInputSchema = z.object({
  projectId: idSchema,
  title: nameSchema,
  description: longTextSchema.default(""),
  priority: taskPrioritySchema.default("medium"),
  stage: projectStageSchema.default("planning"),
  parentTaskId: idSchema.nullable().default(null),
});

export type CreateTaskInput = z.input<typeof createTaskInputSchema>;

export const updateTaskInputSchema = z
  .object({
    title: nameSchema,
    description: longTextSchema,
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    stage: projectStageSchema,
    blockedReason: shortTextSchema.nullable(),
    parentTaskId: idSchema.nullable(),
  })
  .partial();

export type UpdateTaskInput = z.input<typeof updateTaskInputSchema>;

export function createTask(input: CreateTaskInput, deps?: DomainDeps): Task {
  const parsed = createTaskInputSchema.parse(input);
  const now = resolveNow(deps);
  return {
    id: resolveId(deps),
    ...parsed,
    status: "todo",
    blockedReason: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

/**
 * Task update rules (docs/TESTING_STRATEGY.md "Task status rules"):
 * - `blocked` requires a blocked reason.
 * - Leaving `blocked` clears the reason.
 * - Entering `done` stamps `completedAt`; leaving `done` clears it.
 * - A task may not become its own parent.
 * Returns an updated copy with a bumped revision. Never mutates.
 */
export function updateTask(task: Task, changes: UpdateTaskInput, deps?: DomainDeps): Task {
  const parsed = updateTaskInputSchema.parse(changes);

  if (parsed.parentTaskId !== undefined && parsed.parentTaskId === task.id) {
    throw new DomainError(
      "VALIDATION_FAILED",
      "A task cannot be its own parent.",
      "Choose a different parent task or none.",
    );
  }

  const nextStatus = parsed.status ?? task.status;
  let blockedReason =
    parsed.blockedReason !== undefined ? parsed.blockedReason : task.blockedReason;

  if (nextStatus === "blocked") {
    if (blockedReason === null || blockedReason.trim() === "") {
      throw new DomainError(
        "VALIDATION_FAILED",
        "A blocked task requires a blocked reason.",
        "Provide blockedReason when setting status to blocked.",
      );
    }
  } else {
    blockedReason = null;
  }

  const now = resolveNow(deps);
  const wasDone = task.status === "done";
  const isDone = nextStatus === "done";
  const completedAt = isDone ? (wasDone ? task.completedAt : now) : null;

  return {
    ...task,
    ...definedProps(parsed),
    status: nextStatus,
    blockedReason,
    completedAt,
    revision: task.revision + 1,
    updatedAt: now,
  };
}
