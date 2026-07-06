import { z } from "zod";
import {
  idSchema,
  timestampSchema,
  nameSchema,
  longTextSchema,
  definedProps,
  resolveId,
  resolveNow,
  type DomainDeps,
} from "./common.js";
import { DomainError } from "./errors.js";

// Explicit stages (docs/PRODUCT_REQUIREMENTS.md §5). A stage changes only
// through an explicit user or tool action — never inferred from behavior.
export const PROJECT_STAGES = [
  "discovery",
  "planning",
  "building",
  "testing",
  "reviewing",
  "shipping",
  "maintenance",
] as const;

export const projectStageSchema = z.enum(PROJECT_STAGES);
export type ProjectStage = z.infer<typeof projectStageSchema>;

export function isProjectStage(value: unknown): value is ProjectStage {
  return projectStageSchema.safeParse(value).success;
}

export const PROJECT_STATUSES = ["active", "archived"] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectSchema = z.object({
  id: idSchema,
  name: nameSchema,
  description: longTextSchema,
  goal: longTextSchema,
  definitionOfDone: longTextSchema,
  currentStage: projectStageSchema,
  status: projectStatusSchema,
  revision: z.number().int().positive(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Project = z.infer<typeof projectSchema>;

export const createProjectInputSchema = z.object({
  name: nameSchema,
  description: longTextSchema.default(""),
  goal: longTextSchema.default(""),
  definitionOfDone: longTextSchema.default(""),
  currentStage: projectStageSchema.default("discovery"),
});

export type CreateProjectInput = z.input<typeof createProjectInputSchema>;

export const updateProjectInputSchema = z
  .object({
    name: nameSchema,
    description: longTextSchema,
    goal: longTextSchema,
    definitionOfDone: longTextSchema,
  })
  .partial();

export type UpdateProjectInput = z.input<typeof updateProjectInputSchema>;

export function createProject(input: CreateProjectInput, deps?: DomainDeps): Project {
  const parsed = createProjectInputSchema.parse(input);
  const now = resolveNow(deps);
  return {
    id: resolveId(deps),
    ...parsed,
    status: "active",
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

/** Returns an updated copy with a bumped revision. Never mutates. */
export function updateProjectDetails(
  project: Project,
  changes: UpdateProjectInput,
  deps?: DomainDeps,
): Project {
  const parsed = updateProjectInputSchema.parse(changes);
  return {
    ...project,
    ...definedProps(parsed),
    revision: project.revision + 1,
    updatedAt: resolveNow(deps),
  };
}

/** Explicit stage change (docs/TOOL_AND_EVENT_MODEL.md `update_project_stage`). */
export function changeProjectStage(
  project: Project,
  stage: ProjectStage,
  deps?: DomainDeps,
): Project {
  if (!isProjectStage(stage)) {
    throw new DomainError(
      "VALIDATION_FAILED",
      `Unknown project stage: ${String(stage)}`,
      `Use one of: ${PROJECT_STAGES.join(", ")}.`,
    );
  }
  return {
    ...project,
    currentStage: stage,
    revision: project.revision + 1,
    updatedAt: resolveNow(deps),
  };
}

export function archiveProject(project: Project, deps?: DomainDeps): Project {
  return {
    ...project,
    status: "archived",
    revision: project.revision + 1,
    updatedAt: resolveNow(deps),
  };
}

export function restoreProject(project: Project, deps?: DomainDeps): Project {
  return {
    ...project,
    status: "active",
    revision: project.revision + 1,
    updatedAt: resolveNow(deps),
  };
}
