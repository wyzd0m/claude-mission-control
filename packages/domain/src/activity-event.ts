import { z } from "zod";
import {
  idSchema,
  timestampSchema,
  shortTextSchema,
  idListSchema,
  LIMITS,
  resolveId,
  resolveNow,
  type DomainDeps,
} from "./common.js";
import { DomainError } from "./errors.js";

// Activity event contract (docs/TOOL_AND_EVENT_MODEL.md). Events are the only
// source of truth for the visualization: animation follows event state, never
// the other way around, and progress exists only when explicitly reported.

export const DEPARTMENTS = [
  "command_core",
  "planning_bay",
  "research_archive",
  "build_workshop",
  "testing_lab",
  "memory_vault",
  "security_gate",
  "delivery_dock",
] as const;

export const departmentSchema = z.enum(DEPARTMENTS);
export type Department = z.infer<typeof departmentSchema>;

export const EVENT_STATUSES = [
  "queued",
  "travelling",
  "working",
  "waiting_for_input",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export const eventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof eventStatusSchema>;

export const TERMINAL_EVENT_STATUSES: readonly EventStatus[] = ["succeeded", "failed", "cancelled"];

const ALLOWED_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  queued: ["travelling", "working", "failed", "cancelled"],
  travelling: ["working", "failed", "cancelled"],
  working: ["waiting_for_input", "succeeded", "failed", "cancelled"],
  waiting_for_input: ["working", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function isTerminalEventStatus(status: EventStatus): boolean {
  return TERMINAL_EVENT_STATUSES.includes(status);
}

export function canTransitionEvent(from: EventStatus, to: EventStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const activityEventSchema = z.object({
  id: idSchema,
  projectId: idSchema.nullable(),
  correlationId: idSchema,
  toolName: z.string().min(1).max(LIMITS.name),
  displayLabel: z.string().min(1).max(LIMITS.label),
  department: departmentSchema,
  status: eventStatusSchema,
  startedAt: timestampSchema,
  updatedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  progressCurrent: z.number().int().nonnegative().nullable(),
  progressTotal: z.number().int().positive().nullable(),
  progressMessage: shortTextSchema.nullable(),
  relatedTaskIds: idListSchema,
  requiresInput: z.boolean(),
  resultSummary: shortTextSchema.nullable(),
  errorCode: z.string().max(LIMITS.name).nullable(),
  errorSummary: shortTextSchema.nullable(),
});

export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const createActivityEventInputSchema = z.object({
  projectId: idSchema.nullable().default(null),
  correlationId: idSchema.optional(),
  toolName: z.string().min(1).max(LIMITS.name),
  displayLabel: z.string().min(1).max(LIMITS.label),
  department: departmentSchema,
  relatedTaskIds: idListSchema.default([]),
});

export type CreateActivityEventInput = z.input<typeof createActivityEventInputSchema>;

export function createActivityEvent(
  input: CreateActivityEventInput,
  deps?: DomainDeps,
): ActivityEvent {
  const parsed = createActivityEventInputSchema.parse(input);
  const now = resolveNow(deps);
  return {
    id: resolveId(deps),
    projectId: parsed.projectId,
    correlationId: parsed.correlationId ?? resolveId(deps),
    toolName: parsed.toolName,
    displayLabel: parsed.displayLabel,
    department: parsed.department,
    status: "queued",
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    progressCurrent: null,
    progressTotal: null,
    progressMessage: null,
    relatedTaskIds: parsed.relatedTaskIds,
    requiresInput: false,
    resultSummary: null,
    errorCode: null,
    errorSummary: null,
  };
}

export interface EventTransitionPatch {
  resultSummary?: string;
  errorCode?: string;
  errorSummary?: string;
}

/**
 * Move an event to the next status. Enforces the canonical state machine,
 * stamps `completedAt` on terminal statuses, keeps `requiresInput` truthful,
 * and requires an error code and summary on failure. Returns a copy.
 */
export function transitionEvent(
  event: ActivityEvent,
  to: EventStatus,
  patch: EventTransitionPatch = {},
  deps?: DomainDeps,
): ActivityEvent {
  if (!canTransitionEvent(event.status, to)) {
    throw new DomainError(
      "INVALID_STATUS_TRANSITION",
      `An event cannot move from ${event.status} to ${to}.`,
      isTerminalEventStatus(event.status)
        ? "Terminal events are immutable; create a new event instead."
        : `Allowed next statuses: ${ALLOWED_TRANSITIONS[event.status].join(", ") || "none"}.`,
    );
  }

  if (to === "failed" && (!patch.errorCode || !patch.errorSummary)) {
    throw new DomainError(
      "VALIDATION_FAILED",
      "A failed event requires an errorCode and errorSummary.",
      "Provide the stable error code and a safe summary of the failure.",
    );
  }

  const now = resolveNow(deps);
  return {
    ...event,
    status: to,
    updatedAt: now,
    completedAt: isTerminalEventStatus(to) ? now : null,
    requiresInput: to === "waiting_for_input",
    resultSummary:
      to === "succeeded" ? (patch.resultSummary ?? event.resultSummary) : event.resultSummary,
    errorCode: to === "failed" ? (patch.errorCode ?? null) : event.errorCode,
    errorSummary: to === "failed" ? (patch.errorSummary ?? null) : event.errorSummary,
  };
}

/**
 * Explicit progress only (docs/MCP_OBSERVABILITY_MODEL.md): progress exists
 * when an operation reports it. Unknown progress stays unknown — it is never
 * invented. Returns a copy.
 */
export function reportEventProgress(
  event: ActivityEvent,
  progress: { current: number; total: number; message?: string },
  deps?: DomainDeps,
): ActivityEvent {
  if (isTerminalEventStatus(event.status)) {
    throw new DomainError(
      "INVALID_STATUS_TRANSITION",
      "Progress cannot be reported on a completed event.",
      "Create a new event for new work.",
    );
  }
  if (
    !Number.isInteger(progress.current) ||
    !Number.isInteger(progress.total) ||
    progress.current < 0 ||
    progress.total <= 0 ||
    progress.current > progress.total
  ) {
    throw new DomainError(
      "VALIDATION_FAILED",
      "Progress requires integers with 0 <= current <= total and total > 0.",
      "Report progress only when an operation has explicit countable steps.",
    );
  }
  return {
    ...event,
    progressCurrent: progress.current,
    progressTotal: progress.total,
    progressMessage: progress.message ?? null,
    updatedAt: resolveNow(deps),
  };
}
