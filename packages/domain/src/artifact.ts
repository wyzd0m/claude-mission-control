import { z } from "zod";
import {
  idSchema,
  timestampSchema,
  nameSchema,
  shortTextSchema,
  longTextSchema,
  idListSchema,
  resolveId,
  resolveNow,
  type DomainDeps,
} from "./common.js";
import { DomainError } from "./errors.js";

// Artifacts store metadata only. File content is never copied by default
// (docs/ACCEPTANCE_CRITERIA.md "Local project system").

export const ARTIFACT_VERIFICATION_STATUSES = ["unverified", "verified", "failed"] as const;
export const artifactVerificationStatusSchema = z.enum(ARTIFACT_VERIFICATION_STATUSES);
export type ArtifactVerificationStatus = z.infer<typeof artifactVerificationStatusSchema>;

export const artifactSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  name: nameSchema,
  type: shortTextSchema,
  pathOrReference: shortTextSchema,
  description: longTextSchema,
  relatedTaskIds: idListSchema,
  verificationStatus: artifactVerificationStatusSchema,
  verificationNote: shortTextSchema.nullable(),
  verifiedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type Artifact = z.infer<typeof artifactSchema>;

export const createArtifactInputSchema = z.object({
  projectId: idSchema,
  name: nameSchema,
  type: shortTextSchema.default("file"),
  pathOrReference: shortTextSchema,
  description: longTextSchema.default(""),
  relatedTaskIds: idListSchema.default([]),
});

export type CreateArtifactInput = z.input<typeof createArtifactInputSchema>;

export function createArtifact(input: CreateArtifactInput, deps?: DomainDeps): Artifact {
  const parsed = createArtifactInputSchema.parse(input);
  return {
    id: resolveId(deps),
    ...parsed,
    verificationStatus: "unverified",
    verificationNote: null,
    verifiedAt: null,
    createdAt: resolveNow(deps),
  };
}

/**
 * Verification requires identifying the validation performed
 * (docs/TOOL_AND_EVENT_MODEL.md `mark_artifact_verified`). Returns a copy.
 */
export function setArtifactVerification(
  artifact: Artifact,
  status: Exclude<ArtifactVerificationStatus, "unverified">,
  note: string,
  deps?: DomainDeps,
): Artifact {
  if (note.trim() === "") {
    throw new DomainError(
      "VALIDATION_FAILED",
      "Verification requires a note identifying the validation performed.",
      "Describe what was checked and how.",
    );
  }
  return {
    ...artifact,
    verificationStatus: status,
    verificationNote: note,
    verifiedAt: resolveNow(deps),
  };
}
