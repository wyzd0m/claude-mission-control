import { z } from "zod";
import {
  idSchema,
  timestampSchema,
  nameSchema,
  shortTextSchema,
  textListSchema,
  resolveId,
  resolveNow,
  type DomainDeps,
} from "./common.js";

// A checkpoint is a structured handoff for another conversation
// (docs/PRODUCT_REQUIREMENTS.md §6).

export const checkpointSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  summary: nameSchema,
  completedWork: textListSchema,
  openWork: textListSchema,
  decisions: textListSchema,
  blockers: textListSchema,
  recommendedNextAction: shortTextSchema,
  createdAt: timestampSchema,
});

export type Checkpoint = z.infer<typeof checkpointSchema>;

export const createCheckpointInputSchema = z.object({
  projectId: idSchema,
  summary: nameSchema,
  completedWork: textListSchema.default([]),
  openWork: textListSchema.default([]),
  decisions: textListSchema.default([]),
  blockers: textListSchema.default([]),
  recommendedNextAction: shortTextSchema.default(""),
});

export type CreateCheckpointInput = z.input<typeof createCheckpointInputSchema>;

export function createCheckpoint(input: CreateCheckpointInput, deps?: DomainDeps): Checkpoint {
  const parsed = createCheckpointInputSchema.parse(input);
  return {
    id: resolveId(deps),
    ...parsed,
    createdAt: resolveNow(deps),
  };
}
