import {
  createActivityEvent,
  transitionEvent,
  isTerminalEventStatus,
  isDomainError,
  type ActivityEvent,
  type CurrentActivity,
  type Department,
} from "@mission-control/domain";
import type { ServiceContext } from "./service-context.js";

// The activity event service is the source of truth for everything the
// dashboard and 3D facility may display (docs/MCP_OBSERVABILITY_MODEL.md).
// Rules enforced here:
//   - every Mission Control tool call becomes exactly one persisted event
//   - failures become failed events with the same stable code the tool returned
//   - progress exists only when explicitly reported; it is never invented
//   - previews awaiting approval are open `waiting_for_input` events, so a
//     preview never appears as completed work
//   - the idle state claims nothing beyond "no observable activity"
//
// Synchronous local operations persist queued -> working -> terminal.
// `travelling` is a presentation state a renderer may derive from a real
// queued operation; it is not fabricated here.

export const IDLE_MESSAGE = "Waiting for the next observable Mission Control activity.";

const RESULT_SUMMARY_LIMIT = 500;

export interface ActivityMeta {
  toolName: string;
  displayLabel: string;
  department: Department;
  projectId: string | null;
  relatedTaskIds?: string[];
}

export type { CurrentActivity };

interface ApprovalWait {
  eventId: string;
  expiresAtMs: number;
}

function truncateSummary(text: string): string {
  return text.length > RESULT_SUMMARY_LIMIT ? `${text.slice(0, RESULT_SUMMARY_LIMIT - 1)}…` : text;
}

export function createActivityEventService(ctx: ServiceContext) {
  const deps = { now: ctx.now };
  const approvalWaits = new Map<string, ApprovalWait>();

  function persistTransition(
    event: ActivityEvent,
    to: Parameters<typeof transitionEvent>[1],
    patch?: Parameters<typeof transitionEvent>[2],
  ): ActivityEvent {
    const next = transitionEvent(event, to, patch, deps);
    ctx.events.update(next);
    return next;
  }

  /** Cancel waiting-for-approval events whose confirmation token has expired. */
  function sweepExpiredApprovals(): void {
    const nowMs = ctx.now().getTime();
    for (const [token, wait] of approvalWaits) {
      if (wait.expiresAtMs < nowMs) {
        const event = ctx.events.getById(wait.eventId);
        if (event !== null && !isTerminalEventStatus(event.status)) {
          persistTransition(event, "cancelled");
        }
        approvalWaits.delete(token);
      }
    }
  }

  return {
    /**
     * Run one tool operation under a full event lifecycle. On failure the
     * original error is rethrown with the event's correlation id attached
     * (as `activityCorrelationId`) so the tool result can reference it.
     */
    run<T extends { text: string; payload: Record<string, unknown> }>(
      meta: ActivityMeta,
      fn: () => T,
    ): T & { event: ActivityEvent } {
      let event = createActivityEvent(
        {
          projectId: meta.projectId,
          toolName: meta.toolName,
          displayLabel: meta.displayLabel,
          department: meta.department,
          relatedTaskIds: meta.relatedTaskIds ?? [],
        },
        deps,
      );
      ctx.events.insert(event);
      event = persistTransition(event, "working");

      try {
        const output = fn();
        event = persistTransition(event, "succeeded", {
          resultSummary: truncateSummary(output.text),
        });
        // Late-bind the project id for tools that create the project they
        // belong to (e.g. create_project).
        const produced = (output.payload as { project?: { id?: unknown } }).project?.id;
        if (event.projectId === null && typeof produced === "string") {
          event = { ...event, projectId: produced };
          ctx.events.update(event);
        }
        return { ...output, event };
      } catch (error) {
        const errorCode = isDomainError(error) ? error.code : "UNEXPECTED_INTERNAL_ERROR";
        // Only domain errors carry safe, user-facing messages; anything else
        // is summarized generically (details go to stderr, never into state).
        const errorSummary = isDomainError(error)
          ? truncateSummary(error.message)
          : "An unexpected internal error occurred.";
        event = persistTransition(event, "failed", { errorCode, errorSummary });
        if (error !== null && typeof error === "object") {
          (error as { activityCorrelationId?: string }).activityCorrelationId = event.correlationId;
        }
        throw error;
      }
    },

    /**
     * Open a Security Gate waiting event for an issued confirmation token.
     * The event stays `waiting_for_input` until the token is applied,
     * rejected, or expires.
     */
    beginApprovalWait(
      token: string,
      expiresAtIso: string,
      meta: Omit<ActivityMeta, "department">,
    ): ActivityEvent {
      let event = createActivityEvent(
        {
          projectId: meta.projectId,
          toolName: meta.toolName,
          displayLabel: meta.displayLabel,
          department: "security_gate",
          relatedTaskIds: meta.relatedTaskIds ?? [],
        },
        deps,
      );
      ctx.events.insert(event);
      event = persistTransition(event, "working");
      event = persistTransition(event, "waiting_for_input");
      approvalWaits.set(token, { eventId: event.id, expiresAtMs: Date.parse(expiresAtIso) });
      return event;
    },

    /** Resolve the waiting event bound to a token. Unknown tokens are a no-op. */
    resolveApprovalWait(
      token: string,
      outcome: "succeeded" | "failed" | "cancelled",
      patch?: { resultSummary?: string; errorCode?: string; errorSummary?: string },
    ): void {
      const wait = approvalWaits.get(token);
      if (!wait) return;
      approvalWaits.delete(token);
      let event = ctx.events.getById(wait.eventId);
      if (event === null || isTerminalEventStatus(event.status)) return;
      // Success leaves the gate through the canonical path:
      // waiting_for_input -> working -> succeeded.
      if (outcome === "succeeded" && event.status === "waiting_for_input") {
        event = persistTransition(event, "working");
      }
      persistTransition(event, outcome, patch);
    },

    /**
     * Cancel events left open by a previous server process. Called at
     * startup: after a restart no operation is actually running and any
     * confirmation tokens are gone, so open events would be dishonest.
     */
    cancelOrphanedOpenEvents(): number {
      const open = ctx.events.listOpen();
      for (const event of open) {
        persistTransition(event, "cancelled");
      }
      return open.length;
    },

    /** Current-activity projection. Honest idle state when nothing is open. */
    getCurrentActivity(): CurrentActivity {
      sweepExpiredApprovals();
      const openEvents = ctx.events.listOpen();
      const idle = openEvents.length === 0;
      return { openEvents, idle, idleMessage: idle ? IDLE_MESSAGE : null };
    },

    /** Timeline projection, newest first. */
    getTimeline(limit = 100, projectId?: string): ActivityEvent[] {
      sweepExpiredApprovals();
      return ctx.events.listRecent(limit, projectId);
    },
  };
}

export type ActivityEventService = ReturnType<typeof createActivityEventService>;
