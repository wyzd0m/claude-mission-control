import { z } from "zod";
import { timestampSchema } from "./common.js";
import { projectSchema } from "./project.js";
import { taskSchema } from "./task.js";
import { decisionSchema } from "./decision.js";
import { artifactSchema } from "./artifact.js";
import { checkpointSchema } from "./checkpoint.js";
import { DomainError } from "./errors.js";

// Portable project export (docs/PRODUCT_REQUIREMENTS.md §8). Activity events
// are operational telemetry and are intentionally not exported: an export is
// for continuing work elsewhere, not for replaying animations.

export const EXPORT_FORMAT_VERSION = 1;

export const projectExportSchema = z.object({
  formatVersion: z.literal(EXPORT_FORMAT_VERSION),
  exportedAt: timestampSchema,
  project: projectSchema,
  tasks: z.array(taskSchema),
  decisions: z.array(decisionSchema),
  artifacts: z.array(artifactSchema),
  checkpoints: z.array(checkpointSchema),
});

export type ProjectExport = z.infer<typeof projectExportSchema>;

/**
 * Validate an untrusted import payload (docs/PRODUCT_REQUIREMENTS.md §8:
 * "Validate imported data before writing it"). Checks the schema first, then
 * referential integrity inside the bundle. Throws IMPORT_INVALID with a safe,
 * actionable message.
 */
export function validateProjectExport(payload: unknown): ProjectExport {
  const parsed = projectExportSchema.safeParse(payload);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length > 0 ? ` at ${first.path.join(".")}` : "";
    throw new DomainError(
      "IMPORT_INVALID",
      `The import file does not match the export format${where}: ${first?.message ?? "unknown error"}.`,
      "Export the project again from Mission Control and import that file unmodified.",
    );
  }

  const bundle = parsed.data;
  const projectId = bundle.project.id;
  const taskIds = new Set(bundle.tasks.map((t) => t.id));

  const fail = (message: string): never => {
    throw new DomainError(
      "IMPORT_INVALID",
      message,
      "Export the project again from Mission Control and import that file unmodified.",
    );
  };

  for (const task of bundle.tasks) {
    if (task.projectId !== projectId) {
      fail(`Task ${task.id} belongs to a different project.`);
    }
    if (task.parentTaskId !== null && !taskIds.has(task.parentTaskId)) {
      fail(`Task ${task.id} references a parent task that is not in the export.`);
    }
    if (task.parentTaskId === task.id) {
      fail(`Task ${task.id} is its own parent.`);
    }
  }
  for (const record of [...bundle.decisions, ...bundle.artifacts, ...bundle.checkpoints]) {
    if (record.projectId !== projectId) {
      fail(`Record ${record.id} belongs to a different project.`);
    }
  }
  for (const decision of bundle.decisions) {
    for (const taskId of decision.relatedTaskIds) {
      if (!taskIds.has(taskId)) {
        fail(`Decision ${decision.id} references task ${taskId}, which is not in the export.`);
      }
    }
  }
  for (const artifact of bundle.artifacts) {
    for (const taskId of artifact.relatedTaskIds) {
      if (!taskIds.has(taskId)) {
        fail(`Artifact ${artifact.id} references task ${taskId}, which is not in the export.`);
      }
    }
  }

  return bundle;
}
