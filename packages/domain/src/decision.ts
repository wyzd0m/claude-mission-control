import { z } from "zod";
import {
  idSchema,
  timestampSchema,
  nameSchema,
  longTextSchema,
  textListSchema,
  idListSchema,
  resolveId,
  resolveNow,
  type DomainDeps,
} from "./common.js";

export const decisionSchema = z.object({
  id: idSchema,
  projectId: idSchema,
  summary: nameSchema,
  rationale: longTextSchema,
  alternativesConsidered: textListSchema,
  relatedTaskIds: idListSchema,
  createdAt: timestampSchema,
});

export type Decision = z.infer<typeof decisionSchema>;

export const createDecisionInputSchema = z.object({
  projectId: idSchema,
  summary: nameSchema,
  rationale: longTextSchema,
  alternativesConsidered: textListSchema.default([]),
  relatedTaskIds: idListSchema.default([]),
});

export type CreateDecisionInput = z.input<typeof createDecisionInputSchema>;

export function createDecision(input: CreateDecisionInput, deps?: DomainDeps): Decision {
  const parsed = createDecisionInputSchema.parse(input);
  return {
    id: resolveId(deps),
    ...parsed,
    createdAt: resolveNow(deps),
  };
}
