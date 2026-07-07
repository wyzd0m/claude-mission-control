// Stable error contract (docs/SYSTEM_ARCHITECTURE.md "Error contract").
// Every error carries a stable machine-readable code, a safe human message,
// and a recovery hint. Correlation IDs are attached by the event layer, not
// here — the domain stays free of operational concerns.

export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "PROJECT_NOT_FOUND",
  "TASK_NOT_FOUND",
  "DECISION_NOT_FOUND",
  "ARTIFACT_NOT_FOUND",
  "CHECKPOINT_NOT_FOUND",
  "EVENT_NOT_FOUND",
  "REVISION_CONFLICT",
  "INVALID_STATUS_TRANSITION",
  "IMPORT_INVALID",
  "IMPORT_CONFLICT",
  "STORAGE_FAILURE",
  "STORAGE_CORRUPT",
  "UI_RESOURCE_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly recovery: string;

  constructor(code: ErrorCode, message: string, recovery: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.recovery = recovery;
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}
