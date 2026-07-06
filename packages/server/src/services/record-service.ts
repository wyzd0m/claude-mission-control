import {
  createArtifact,
  createCheckpoint,
  createDecision,
  setArtifactVerification,
  DomainError,
  type Artifact,
  type Checkpoint,
  type CreateArtifactInput,
  type CreateCheckpointInput,
  type CreateDecisionInput,
  type Decision,
} from "@mission-control/domain";
import { requireProject, type ServiceContext } from "./service-context.js";

/** Decisions, artifacts, and checkpoints — the Memory Vault records. */
export function createRecordService(ctx: ServiceContext) {
  const deps = { now: ctx.now };

  function validateRelatedTasks(projectId: string, relatedTaskIds?: readonly string[]): void {
    for (const taskId of relatedTaskIds ?? []) {
      const task = ctx.tasks.getById(taskId);
      if (task === null || task.projectId !== projectId) {
        throw new DomainError(
          "TASK_NOT_FOUND",
          `Related task ${taskId} was not found in this project.`,
          "Reference only tasks from the same project, or omit relatedTaskIds.",
        );
      }
    }
  }

  return {
    recordDecision(
      input: Omit<CreateDecisionInput, "projectId"> & { projectId?: string | undefined },
    ): Decision {
      const project = requireProject(ctx, input.projectId);
      validateRelatedTasks(project.id, input.relatedTaskIds);
      const decision = createDecision({ ...input, projectId: project.id }, deps);
      ctx.decisions.insert(decision);
      return decision;
    },

    listDecisions(projectId?: string): Decision[] {
      const project = requireProject(ctx, projectId);
      return ctx.decisions.listByProject(project.id);
    },

    registerArtifact(
      input: Omit<CreateArtifactInput, "projectId"> & { projectId?: string | undefined },
    ): Artifact {
      const project = requireProject(ctx, input.projectId);
      validateRelatedTasks(project.id, input.relatedTaskIds);
      const artifact = createArtifact({ ...input, projectId: project.id }, deps);
      ctx.artifacts.insert(artifact);
      return artifact;
    },

    listArtifacts(projectId?: string): Artifact[] {
      const project = requireProject(ctx, projectId);
      return ctx.artifacts.listByProject(project.id);
    },

    /**
     * Record the outcome of a validation against an artifact. The note must
     * identify the validation performed (docs/TOOL_AND_EVENT_MODEL.md:
     * "do not claim a test ran without a valid supplied result").
     */
    recordValidationResult(
      artifactId: string,
      passed: boolean,
      validationPerformed: string,
    ): Artifact {
      const artifact = ctx.artifacts.getById(artifactId);
      if (artifact === null) {
        throw new DomainError(
          "ARTIFACT_NOT_FOUND",
          "The artifact was not found.",
          "List artifacts with list_artifacts to find the right id.",
        );
      }
      const updated = setArtifactVerification(
        artifact,
        passed ? "verified" : "failed",
        validationPerformed,
        deps,
      );
      ctx.artifacts.update(updated);
      return updated;
    },

    saveCheckpoint(
      input: Omit<CreateCheckpointInput, "projectId"> & { projectId?: string | undefined },
    ): Checkpoint {
      const project = requireProject(ctx, input.projectId);
      const checkpoint = createCheckpoint({ ...input, projectId: project.id }, deps);
      ctx.checkpoints.insert(checkpoint);
      return checkpoint;
    },

    getLatestCheckpoint(projectId?: string): Checkpoint | null {
      const project = requireProject(ctx, projectId);
      return ctx.checkpoints.getLatestByProject(project.id);
    },
  };
}

export type RecordService = ReturnType<typeof createRecordService>;
