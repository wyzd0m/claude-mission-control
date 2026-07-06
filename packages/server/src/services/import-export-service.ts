import fs from "node:fs";
import path from "node:path";
import { validateProjectExport, type ProjectExport } from "@mission-control/domain";
import { buildProjectExport, importProject } from "../storage/import-export.js";
import { exportsDirPath } from "../storage/paths.js";
import { hashApprovalPayload } from "./approval-service.js";
import { requireProject, type ServiceContext } from "./service-context.js";

const IMPORT_APPROVAL_KIND = "project_import";

export interface ImportPreview {
  projectId: string;
  projectName: string;
  counts: { tasks: number; decisions: number; artifacts: number; checkpoints: number };
  confirmationToken: string;
  expiresAt: string;
}

export interface ExportResult {
  filePath: string;
  projectId: string;
  projectName: string;
  counts: { tasks: number; decisions: number; artifacts: number; checkpoints: number };
  exportedAt: string;
}

function countsOf(bundle: ProjectExport) {
  return {
    tasks: bundle.tasks.length,
    decisions: bundle.decisions.length,
    artifacts: bundle.artifacts.length,
    checkpoints: bundle.checkpoints.length,
  };
}

function safeFileStem(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned === "" ? "project" : cleaned.slice(0, 40);
}

export function createImportExportService(ctx: ServiceContext) {
  return {
    /**
     * Write a portable export file into the managed exports directory
     * (docs/TOOL_AND_EVENT_MODEL.md `export_project`). Writes only inside the
     * application-data directory; never to arbitrary paths.
     */
    exportProject(projectId?: string): ExportResult {
      const project = requireProject(ctx, projectId);
      const bundle = buildProjectExport(ctx.db, project.id, ctx.now);
      const dir = exportsDirPath();
      fs.mkdirSync(dir, { recursive: true });
      const stamp = ctx.now().toISOString().replace(/[:.]/g, "-");
      const filePath = path.join(dir, `${safeFileStem(project.name)}-${stamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf-8");
      return {
        filePath,
        projectId: project.id,
        projectName: project.name,
        counts: countsOf(bundle),
        exportedAt: bundle.exportedAt,
      };
    },

    /** Validate an untrusted bundle and issue a confirmation token. Writes nothing. */
    previewImport(payload: unknown): ImportPreview {
      const bundle = validateProjectExport(payload);
      const { token, expiresAt } = ctx.approvals.issue(
        IMPORT_APPROVAL_KIND,
        hashApprovalPayload(bundle),
      );
      return {
        projectId: bundle.project.id,
        projectName: bundle.project.name,
        counts: countsOf(bundle),
        confirmationToken: token,
        expiresAt,
      };
    },

    /** Apply a previously previewed import. */
    applyImport(payload: unknown, confirmationToken: string): ProjectExport {
      const bundle = validateProjectExport(payload);
      ctx.approvals.consume(IMPORT_APPROVAL_KIND, confirmationToken, hashApprovalPayload(bundle));
      return importProject(ctx.db, bundle);
    },
  };
}

export type ImportExportService = ReturnType<typeof createImportExportService>;
