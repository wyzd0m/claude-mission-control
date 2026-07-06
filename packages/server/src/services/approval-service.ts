import { createHash, randomUUID } from "node:crypto";
import { DomainError } from "@mission-control/domain";

// Preview/apply approval pattern (docs/TOOL_AND_EVENT_MODEL.md): destructive
// or bulk operations first return a preview with a confirmation token; apply
// consumes the token. Tokens are single-use, expire, and are bound to the
// exact previewed payload so an approval cannot be replayed for a different
// change.
//
// Tokens live in memory: they are conversation-scoped confirmations, not
// durable state. A server restart invalidates open previews, which is safe —
// the user simply previews again.

const DEFAULT_TTL_MS = 10 * 60 * 1000;

interface ApprovalRecord {
  kind: string;
  payloadHash: string;
  expiresAt: number;
  consumed: boolean;
}

export function hashApprovalPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export class ApprovalService {
  private readonly records = new Map<string, ApprovalRecord>();

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  /** Issue a token for a previewed payload. */
  issue(kind: string, payloadHash: string): { token: string; expiresAt: string } {
    const token = randomUUID();
    const expiresAt = this.now().getTime() + this.ttlMs;
    this.records.set(token, { kind, payloadHash, expiresAt, consumed: false });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  /**
   * Consume a token. Throws VALIDATION_FAILED if the token is unknown,
   * expired, already used, or bound to a different payload or operation.
   */
  consume(kind: string, token: string, payloadHash: string): void {
    const record = this.records.get(token);
    const fail = (reason: string): never => {
      throw new DomainError(
        "VALIDATION_FAILED",
        `The confirmation token was rejected: ${reason}.`,
        "Run the preview tool again and apply with the fresh token.",
      );
    };
    if (!record) fail("unknown token");
    if (record!.kind !== kind) fail("token was issued for a different operation");
    if (record!.consumed) fail("token was already used");
    if (record!.expiresAt < this.now().getTime()) fail("token has expired");
    if (record!.payloadHash !== payloadHash) fail("the request no longer matches the preview");
    record!.consumed = true;
  }
}
