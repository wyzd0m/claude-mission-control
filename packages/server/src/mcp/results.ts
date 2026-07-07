import { ZodError } from "zod";
import { isDomainError } from "@mission-control/domain";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Structured result contract for every Mission Control tool:
//   success: { ok: true, ...payload }
//   failure: { ok: false, error: { code, message, recovery } }, isError: true
// The text content mirrors the structured content so hosts without
// structured-content support still get the full information.

export interface ActivityRef {
  eventId: string;
  correlationId: string;
}

export function okResult(
  text: string,
  payload: Record<string, unknown>,
  activity?: ActivityRef,
): CallToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent: { ok: true, ...payload, ...(activity ? { activity } : {}) },
  };
}

export function errorResult(error: unknown): CallToolResult {
  let code = "UNEXPECTED_INTERNAL_ERROR";
  let message = "An unexpected internal error occurred.";
  let recovery = "Retry the operation; if it keeps failing, check the extension logs.";

  if (isDomainError(error)) {
    code = error.code;
    message = error.message;
    recovery = error.recovery;
  } else if (error instanceof ZodError) {
    const issue = error.issues[0];
    code = "VALIDATION_FAILED";
    message = `Invalid input${issue && issue.path.length > 0 ? ` at ${issue.path.join(".")}` : ""}: ${issue?.message ?? "unknown issue"}.`;
    recovery = "Correct the input and call the tool again.";
  } else {
    // Unexpected: log details to stderr (never to stdout — that carries MCP).
    console.error("[mission-control] unexpected tool error", error);
  }

  // Attached by the activity event service when the failure happened inside
  // a tracked tool operation (docs/SYSTEM_ARCHITECTURE.md error contract).
  const correlationId =
    error !== null && typeof error === "object"
      ? (error as { activityCorrelationId?: string }).activityCorrelationId
      : undefined;

  return {
    isError: true,
    content: [
      {
        type: "text",
        text:
          `${code}: ${message} Recovery: ${recovery}` +
          (correlationId ? ` (correlation ${correlationId})` : ""),
      },
    ],
    structuredContent: {
      ok: false,
      error: { code, message, recovery, ...(correlationId ? { correlationId } : {}) },
    },
  };
}
