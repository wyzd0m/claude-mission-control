import { McpServer, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  artifactVerificationStatusSchema,
  idListSchema,
  idSchema,
  isDomainError,
  longTextSchema,
  nameSchema,
  projectStageSchema,
  projectStatusSchema,
  shortTextSchema,
  taskPrioritySchema,
  taskStatusSchema,
  textListSchema,
  SETTING_ACTIVE_PROJECT_ID,
  type Department,
} from "@mission-control/domain";
import fs from "node:fs";
import path from "node:path";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  createActivityEventService,
  type ActivityEventService,
} from "../services/activity-event-service.js";
import { createUiStateService } from "../services/ui-state-service.js";
import { MIGRATIONS } from "../storage/migrations.js";
import {
  backupsDirPath,
  databaseFilePath,
  exportsDirPath,
  resolveDataRoot,
} from "../storage/paths.js";
import {
  DASHBOARD_RESOURCE_URI,
  readDashboardHtml,
  resolveDashboardHtmlPath,
} from "./ui-resource.js";
import { createProjectService } from "../services/project-service.js";
import { createTaskService } from "../services/task-service.js";
import { createRecordService } from "../services/record-service.js";
import { createContextPackageService } from "../services/context-package-service.js";
import { createImportExportService } from "../services/import-export-service.js";
import type { ServiceContext } from "../services/service-context.js";
import { errorResult, okResult } from "./results.js";

export const SERVER_VERSION = "0.1.0";

// The MCP adapter stays thin (docs/SYSTEM_ARCHITECTURE.md): declare tools,
// validate input, call a service, shape the structured result. Every
// description states its side effects so hosts and users can judge a call
// before approving it. Every call runs under an activity-event lifecycle
// (docs/MCP_OBSERVABILITY_MODEL.md): one persisted event per tool request,
// accurate terminal status, and open waiting events for pending approvals.

interface ToolSpec<Shape extends z.ZodRawShape> {
  title: string;
  description: string;
  department: Department;
  inputSchema: Shape;
}

// User-facing activity labels (docs/MCP_OBSERVABILITY_MODEL.md). Technical
// tool names stay available in the event record.
const ACTIVITY_LABELS: Record<string, string> = {
  create_project: "Creating a project",
  list_projects: "Listing projects",
  get_project_brief: "Loading the project brief",
  set_active_project: "Switching the active project",
  update_project: "Updating project details",
  update_project_stage: "Updating the project stage",
  archive_project: "Archiving a project",
  create_task: "Creating a task",
  update_task: "Updating a task",
  list_tasks: "Listing tasks",
  preview_bulk_task_update: "Previewing a bulk task update",
  apply_bulk_task_update: "Applying a bulk task update",
  record_decision: "Recording a project decision",
  list_decisions: "Listing decisions",
  save_checkpoint: "Saving a project checkpoint",
  get_latest_checkpoint: "Loading the latest checkpoint",
  prepare_project_context: "Preparing project context",
  register_artifact: "Registering an artifact",
  list_artifacts: "Listing artifacts",
  mark_artifact_verified: "Recording artifact verification",
  record_validation_result: "Recording a validation result",
  export_project: "Packaging a project export",
  preview_project_import: "Previewing a project import",
  apply_project_import: "Applying a project import",
};

// Preview tools open a Security Gate waiting event bound to their token;
// apply tools resolve it.
const APPROVAL_WAIT_LABELS: Record<string, string> = {
  preview_bulk_task_update: "Awaiting approval: bulk task update",
  preview_project_import: "Awaiting approval: project import",
};
const APPROVAL_CONSUMING_TOOLS = new Set(["apply_bulk_task_update", "apply_project_import"]);

function isTokenRejection(error: unknown): boolean {
  return isDomainError(error) && /confirmation token was rejected/.test(error.message);
}

export function createMissionControlServer(
  ctx: ServiceContext,
  options?: { activity?: ActivityEventService },
): McpServer {
  const projects = createProjectService(ctx);
  const tasks = createTaskService(ctx);
  const records = createRecordService(ctx);
  const contextPackages = createContextPackageService(ctx);
  const importExport = createImportExportService(ctx);
  const activity = options?.activity ?? createActivityEventService(ctx);

  const server = new McpServer({ name: "claude-mission-control", version: SERVER_VERSION });

  function register<Shape extends z.ZodRawShape>(
    name: string,
    spec: ToolSpec<Shape>,
    handler: (input: z.infer<z.ZodObject<Shape>>) => {
      text: string;
      payload: Record<string, unknown>;
    },
  ): void {
    server.registerTool(
      name,
      {
        title: spec.title,
        description: spec.description,
        inputSchema: spec.inputSchema,
        _meta: { missionControl: { department: spec.department } },
      },
      ((input: z.infer<z.ZodObject<Shape>>): CallToolResult => {
        const raw = input as Record<string, unknown>;
        const displayLabel = ACTIVITY_LABELS[name] ?? spec.title;
        // Events may only reference projects that actually exist; an invalid
        // input id still fails inside the handler with the proper error.
        const candidateProjectId =
          typeof raw.projectId === "string"
            ? raw.projectId
            : ctx.settings.get(SETTING_ACTIVE_PROJECT_ID);
        const projectId =
          candidateProjectId !== null && ctx.projects.getById(candidateProjectId) !== null
            ? candidateProjectId
            : null;
        const relatedTaskIds: string[] = [];
        if (typeof raw.taskId === "string") relatedTaskIds.push(raw.taskId);
        if (Array.isArray(raw.affected)) {
          for (const entry of raw.affected) {
            const id = (entry as { id?: unknown } | null)?.id;
            if (typeof id === "string") relatedTaskIds.push(id);
          }
        }
        const token = typeof raw.confirmationToken === "string" ? raw.confirmationToken : null;

        try {
          const { text, payload, event } = activity.run(
            {
              toolName: name,
              displayLabel,
              department: spec.department,
              projectId,
              relatedTaskIds,
            },
            () => handler(input),
          );

          const waitLabel = APPROVAL_WAIT_LABELS[name];
          if (waitLabel !== undefined) {
            const preview = (
              payload as { preview?: { confirmationToken?: unknown; expiresAt?: unknown } }
            ).preview;
            if (
              preview &&
              typeof preview.confirmationToken === "string" &&
              typeof preview.expiresAt === "string"
            ) {
              activity.beginApprovalWait(preview.confirmationToken, preview.expiresAt, {
                toolName: name,
                displayLabel: waitLabel,
                projectId: event.projectId,
                relatedTaskIds,
              });
            }
          }
          if (APPROVAL_CONSUMING_TOOLS.has(name) && token !== null) {
            activity.resolveApprovalWait(token, "succeeded", {
              resultSummary: "Approved and applied.",
            });
          }

          return okResult(text, payload, { eventId: event.id, correlationId: event.correlationId });
        } catch (error) {
          // A burnt token means the previewed change failed after approval;
          // a rejected token leaves the waiting event for the expiry sweep.
          if (APPROVAL_CONSUMING_TOOLS.has(name) && token !== null && !isTokenRejection(error)) {
            activity.resolveApprovalWait(token, "failed", {
              errorCode: isDomainError(error) ? error.code : "UNEXPECTED_INTERNAL_ERROR",
              errorSummary: isDomainError(error)
                ? error.message
                : "An unexpected internal error occurred.",
            });
          }
          return errorResult(error);
        }
        // The SDK's callback generic does not unify with a locally inferred
        // z.infer of the same shape; the runtime contract is identical.
      }) as unknown as ToolCallback<Shape>,
    );
  }

  const projectIdField = {
    projectId: idSchema
      .optional()
      .describe("Project id. Defaults to the active project when omitted."),
  };

  // ---------------------------------------------------------------- projects

  register(
    "create_project",
    {
      title: "Create project",
      description:
        "Creates a local Mission Control project. Side effect: writes one project record to local storage. The first project becomes the active project.",
      department: "planning_bay",
      inputSchema: {
        name: nameSchema.describe("Project name."),
        description: longTextSchema.optional().describe("What the project is."),
        goal: longTextSchema.optional().describe("The outcome the project aims for."),
        definitionOfDone: longTextSchema.optional().describe("How completion is judged."),
        currentStage: projectStageSchema
          .optional()
          .describe("Initial stage; defaults to discovery."),
      },
    },
    (input) => {
      const project = projects.create(input);
      return {
        text: `Created project "${project.name}" (${project.id}), stage ${project.currentStage}.`,
        payload: { project },
      };
    },
  );

  register(
    "list_projects",
    {
      title: "List projects",
      description: "Lists project summaries from local storage. No side effects.",
      department: "command_core",
      inputSchema: {
        status: projectStatusSchema.optional().describe("Filter by status (active or archived)."),
      },
    },
    (input) => {
      const summaries = projects.list(input.status);
      const activeId = projects.getActiveProjectId();
      return {
        text:
          summaries.length === 0
            ? "No projects exist yet. Create one with create_project."
            : `${summaries.length} project(s): ${summaries.map((p) => p.name).join(", ")}.`,
        payload: { projects: summaries, activeProjectId: activeId },
      };
    },
  );

  register(
    "get_project_brief",
    {
      title: "Get project brief",
      description:
        "Returns a compact brief of one project: goal, definition of done, stage, task counts, and latest checkpoint. No side effects.",
      department: "command_core",
      inputSchema: { ...projectIdField },
    },
    (input) => {
      const brief = projects.brief(input.projectId);
      return {
        text: `Project "${brief.project.name}" — stage ${brief.project.currentStage}, ${brief.openTaskCount} open task(s), ${brief.blockedTaskCount} blocked.`,
        payload: { brief },
      };
    },
  );

  register(
    "set_active_project",
    {
      title: "Set active project",
      description:
        "Changes which project is active. Side effect: updates one local setting. Tools called without projectId use the active project.",
      department: "planning_bay",
      inputSchema: { projectId: idSchema.describe("The project to activate.") },
    },
    (input) => {
      const project = projects.setActive(input.projectId);
      return {
        text: `Active project is now "${project.name}" (${project.id}).`,
        payload: { project },
      };
    },
  );

  register(
    "update_project",
    {
      title: "Update project details",
      description:
        "Updates a project's name, description, goal, or definition of done. Side effect: rewrites one project record. Does not change the stage.",
      department: "planning_bay",
      inputSchema: {
        ...projectIdField,
        name: nameSchema.optional(),
        description: longTextSchema.optional(),
        goal: longTextSchema.optional(),
        definitionOfDone: longTextSchema.optional(),
      },
    },
    ({ projectId, ...changes }) => {
      const project = projects.updateDetails(changes, projectId);
      return {
        text: `Updated project "${project.name}" (revision ${project.revision}).`,
        payload: { project },
      };
    },
  );

  register(
    "update_project_stage",
    {
      title: "Update project stage",
      description:
        "Explicitly changes the saved project stage. Side effect: rewrites one project record. The stage is never inferred from behavior — only this explicit call changes it.",
      department: "planning_bay",
      inputSchema: {
        ...projectIdField,
        stage: projectStageSchema.describe("The new explicit stage."),
      },
    },
    (input) => {
      const project = projects.changeStage(input.stage, input.projectId);
      return {
        text: `Project "${project.name}" stage is now ${project.currentStage}.`,
        payload: { project },
      };
    },
  );

  register(
    "archive_project",
    {
      title: "Archive project",
      description:
        "Archives a project (reversible; no data is deleted). Side effect: rewrites one project record and clears it as the active project.",
      department: "planning_bay",
      inputSchema: { projectId: idSchema.describe("The project to archive.") },
    },
    (input) => {
      const project = projects.archive(input.projectId);
      return { text: `Archived project "${project.name}".`, payload: { project } };
    },
  );

  // ------------------------------------------------------------------- tasks

  register(
    "create_task",
    {
      title: "Create task",
      description:
        "Creates one task in a project. Side effect: writes one task record to local storage.",
      department: "planning_bay",
      inputSchema: {
        ...projectIdField,
        title: nameSchema.describe("Short task title."),
        description: longTextSchema.optional(),
        priority: taskPrioritySchema.optional().describe("low, medium (default), or high."),
        stage: projectStageSchema
          .optional()
          .describe("Stage the task belongs to; defaults to planning."),
        parentTaskId: idSchema.optional().describe("Optional parent task in the same project."),
      },
    },
    (input) => {
      const task = tasks.create(input);
      return { text: `Created task "${task.title}" (${task.id}).`, payload: { task } };
    },
  );

  register(
    "update_task",
    {
      title: "Update task",
      description:
        "Updates fields of one task. Side effect: rewrites one task record. Setting status to blocked requires blockedReason; leaving blocked clears it; done stamps the completion time.",
      department: "build_workshop",
      inputSchema: {
        taskId: idSchema.describe("The task to update."),
        title: nameSchema.optional(),
        description: longTextSchema.optional(),
        status: taskStatusSchema.optional(),
        priority: taskPrioritySchema.optional(),
        stage: projectStageSchema.optional(),
        blockedReason: shortTextSchema.nullable().optional(),
        parentTaskId: idSchema.nullable().optional(),
      },
    },
    ({ taskId, ...changes }) => {
      const task = tasks.update(taskId, changes);
      return {
        text: `Updated task "${task.title}" (status ${task.status}, revision ${task.revision}).`,
        payload: { task },
      };
    },
  );

  register(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "Lists tasks of a project, optionally filtered by status or stage. No side effects.",
      department: "planning_bay",
      inputSchema: {
        ...projectIdField,
        status: taskStatusSchema.optional(),
        stage: projectStageSchema.optional(),
      },
    },
    (input) => {
      const list = tasks.list(input.projectId, {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
      });
      return {
        text: `${list.length} task(s) found.`,
        payload: { tasks: list },
      };
    },
  );

  register(
    "preview_bulk_task_update",
    {
      title: "Preview bulk task update",
      description:
        "Dry-run of a bulk task change. No side effects: returns the affected tasks and a single-use confirmation token for apply_bulk_task_update. Nothing is modified.",
      department: "security_gate",
      inputSchema: {
        ...projectIdField,
        filterStatus: taskStatusSchema.optional().describe("Only tasks with this status."),
        filterStage: projectStageSchema.optional().describe("Only tasks in this stage."),
        status: taskStatusSchema.optional().describe("New status to apply."),
        priority: taskPrioritySchema.optional().describe("New priority to apply."),
        stage: projectStageSchema.optional().describe("New stage to apply."),
        blockedReason: shortTextSchema.optional().describe("Required when status becomes blocked."),
      },
    },
    (input) => {
      const filter: Record<string, unknown> = {};
      if (input.filterStatus !== undefined) filter.status = input.filterStatus;
      if (input.filterStage !== undefined) filter.stage = input.filterStage;
      const changes: Record<string, unknown> = {};
      if (input.status !== undefined) changes.status = input.status;
      if (input.priority !== undefined) changes.priority = input.priority;
      if (input.stage !== undefined) changes.stage = input.stage;
      if (input.blockedReason !== undefined) changes.blockedReason = input.blockedReason;
      const preview = tasks.previewBulkUpdate({
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        filter,
        changes,
      });
      return {
        text: `Preview: ${preview.affected.length} task(s) would change. Confirm with apply_bulk_task_update and token ${preview.confirmationToken} before ${preview.expiresAt}. Nothing has been modified yet.`,
        payload: { preview },
      };
    },
  );

  register(
    "apply_bulk_task_update",
    {
      title: "Apply bulk task update",
      description:
        "Applies a bulk task change previously previewed with preview_bulk_task_update. Side effect: rewrites every affected task in one transaction. Requires the preview's confirmation token; fails if any task changed since the preview.",
      department: "security_gate",
      inputSchema: {
        ...projectIdField,
        filterStatus: taskStatusSchema.optional(),
        filterStage: projectStageSchema.optional(),
        status: taskStatusSchema.optional(),
        priority: taskPrioritySchema.optional(),
        stage: projectStageSchema.optional(),
        blockedReason: shortTextSchema.optional(),
        affected: z
          .array(z.object({ id: idSchema, revision: z.number().int().positive() }))
          .max(500)
          .describe("The affected list exactly as returned by the preview."),
        confirmationToken: z.string().describe("Token from preview_bulk_task_update."),
      },
    },
    (input) => {
      const filter: Record<string, unknown> = {};
      if (input.filterStatus !== undefined) filter.status = input.filterStatus;
      if (input.filterStage !== undefined) filter.stage = input.filterStage;
      const changes: Record<string, unknown> = {};
      if (input.status !== undefined) changes.status = input.status;
      if (input.priority !== undefined) changes.priority = input.priority;
      if (input.stage !== undefined) changes.stage = input.stage;
      if (input.blockedReason !== undefined) changes.blockedReason = input.blockedReason;
      const updated = tasks.applyBulkUpdate({
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        filter,
        changes,
        affected: input.affected.map(({ id, revision }) => ({ id, revision })),
        confirmationToken: input.confirmationToken,
      });
      return {
        text: `Applied bulk update to ${updated.length} task(s).`,
        payload: { tasks: updated },
      };
    },
  );

  // ------------------------------------------------- decisions & checkpoints

  register(
    "record_decision",
    {
      title: "Record decision",
      description:
        "Records a decision with its rationale and alternatives. Side effect: writes one decision record to local storage.",
      department: "memory_vault",
      inputSchema: {
        ...projectIdField,
        summary: nameSchema.describe("One-line decision summary."),
        rationale: longTextSchema.describe("Why this decision was made."),
        alternativesConsidered: textListSchema.optional(),
        relatedTaskIds: idListSchema.optional(),
      },
    },
    (input) => {
      const decision = records.recordDecision(input);
      return {
        text: `Recorded decision "${decision.summary}" (${decision.id}).`,
        payload: { decision },
      };
    },
  );

  register(
    "list_decisions",
    {
      title: "List decisions",
      description: "Lists the saved decisions of a project, oldest first. No side effects.",
      department: "memory_vault",
      inputSchema: { ...projectIdField },
    },
    (input) => {
      const list = records.listDecisions(input.projectId);
      return { text: `${list.length} decision(s) found.`, payload: { decisions: list } };
    },
  );

  register(
    "save_checkpoint",
    {
      title: "Save checkpoint",
      description:
        "Saves a structured handoff checkpoint (completed work, open work, decisions, blockers, next action) so another conversation can continue. Side effect: writes one checkpoint record.",
      department: "memory_vault",
      inputSchema: {
        ...projectIdField,
        summary: nameSchema.describe("One-line checkpoint summary."),
        completedWork: textListSchema.optional(),
        openWork: textListSchema.optional(),
        decisions: textListSchema.optional(),
        blockers: textListSchema.optional(),
        recommendedNextAction: shortTextSchema.optional(),
      },
    },
    (input) => {
      const checkpoint = records.saveCheckpoint(input);
      return {
        text: `Saved checkpoint "${checkpoint.summary}" (${checkpoint.id}).`,
        payload: { checkpoint },
      };
    },
  );

  register(
    "get_latest_checkpoint",
    {
      title: "Get latest checkpoint",
      description:
        "Returns the most recent checkpoint of a project, or null if none exists. No side effects.",
      department: "memory_vault",
      inputSchema: { ...projectIdField },
    },
    (input) => {
      const checkpoint = records.getLatestCheckpoint(input.projectId);
      return {
        text: checkpoint
          ? `Latest checkpoint: "${checkpoint.summary}" (${checkpoint.createdAt}).`
          : "No checkpoint has been saved for this project yet.",
        payload: { checkpoint },
      };
    },
  );

  register(
    "prepare_project_context",
    {
      title: "Prepare project context",
      description:
        "Builds a concise context package from saved records: goal, open and blocked tasks, recent decisions, and the latest checkpoint, with source record ids and facts separated from recommendations. No side effects.",
      department: "memory_vault",
      inputSchema: {
        ...projectIdField,
        maxTasks: z.number().int().min(1).max(100).optional(),
        maxDecisions: z.number().int().min(1).max(50).optional(),
      },
    },
    (input) => {
      const pkg = contextPackages.prepare(input);
      return {
        text: `Context package prepared from ${pkg.sourceRecordIds.length} record(s).`,
        payload: { contextPackage: pkg },
      };
    },
  );

  // --------------------------------------------------------------- artifacts

  register(
    "register_artifact",
    {
      title: "Register artifact",
      description:
        "Registers artifact metadata (name, type, local path or reference). Side effect: writes one metadata record. File contents are never read or copied.",
      department: "build_workshop",
      inputSchema: {
        ...projectIdField,
        name: nameSchema,
        type: shortTextSchema.optional().describe("Kind of artifact, e.g. file, document, url."),
        pathOrReference: shortTextSchema.describe(
          "Local path or logical reference. Not read by Mission Control.",
        ),
        description: longTextSchema.optional(),
        relatedTaskIds: idListSchema.optional(),
      },
    },
    (input) => {
      const artifact = records.registerArtifact(input);
      return {
        text: `Registered artifact "${artifact.name}" (${artifact.id}).`,
        payload: { artifact },
      };
    },
  );

  register(
    "list_artifacts",
    {
      title: "List artifacts",
      description: "Lists artifact metadata of a project. No side effects.",
      department: "build_workshop",
      inputSchema: { ...projectIdField },
    },
    (input) => {
      const list = records.listArtifacts(input.projectId);
      return { text: `${list.length} artifact(s) found.`, payload: { artifacts: list } };
    },
  );

  register(
    "mark_artifact_verified",
    {
      title: "Mark artifact verified",
      description:
        "Sets an artifact's verification status. Side effect: rewrites one artifact record. Requires identifying the validation performed — never claim verification without one.",
      department: "testing_lab",
      inputSchema: {
        artifactId: idSchema,
        status: artifactVerificationStatusSchema
          .exclude(["unverified"])
          .describe("verified or failed."),
        validationPerformed: shortTextSchema.min(1).describe("What was checked and how."),
      },
    },
    (input) => {
      const artifact = records.recordValidationResult(
        input.artifactId,
        input.status === "verified",
        input.validationPerformed,
      );
      return {
        text: `Artifact "${artifact.name}" is now ${artifact.verificationStatus} (${artifact.verificationNote}).`,
        payload: { artifact },
      };
    },
  );

  register(
    "record_validation_result",
    {
      title: "Record validation result",
      description:
        "Records the outcome of a validation run against a registered artifact. Side effect: rewrites one artifact record. Requires the result of a validation that actually ran — do not claim a test ran without a supplied result.",
      department: "testing_lab",
      inputSchema: {
        artifactId: idSchema.describe("The artifact the validation applies to."),
        passed: z.boolean().describe("true if the validation passed."),
        validationPerformed: shortTextSchema.min(1).describe("What was validated and how."),
      },
    },
    (input) => {
      const artifact = records.recordValidationResult(
        input.artifactId,
        input.passed,
        input.validationPerformed,
      );
      return {
        text: `Recorded ${input.passed ? "passing" : "failing"} validation for "${artifact.name}".`,
        payload: { artifact },
      };
    },
  );

  // ----------------------------------------------------------- import/export

  register(
    "export_project",
    {
      title: "Export project",
      description:
        "Writes a portable JSON export of one project into the Mission Control exports directory and returns the file path. Side effect: creates one file inside the application-data directory only.",
      department: "delivery_dock",
      inputSchema: { ...projectIdField },
    },
    (input) => {
      const result = importExport.exportProject(input.projectId);
      return {
        text: `Exported "${result.projectName}" (${result.counts.tasks} tasks, ${result.counts.decisions} decisions) to ${result.filePath}.`,
        payload: { export: result },
      };
    },
  );

  register(
    "preview_project_import",
    {
      title: "Preview project import",
      description:
        "Validates a project export bundle and returns a summary plus a single-use confirmation token for apply_project_import. No side effects: nothing is written.",
      department: "security_gate",
      inputSchema: {
        bundle: z
          .record(z.string(), z.unknown())
          .describe("The parsed JSON content of a Mission Control export file."),
      },
    },
    (input) => {
      const preview = importExport.previewImport(input.bundle);
      return {
        text: `Import preview: project "${preview.projectName}" with ${preview.counts.tasks} tasks, ${preview.counts.decisions} decisions, ${preview.counts.artifacts} artifacts, ${preview.counts.checkpoints} checkpoints. Confirm with apply_project_import and token ${preview.confirmationToken} before ${preview.expiresAt}. Nothing has been imported yet.`,
        payload: { preview },
      };
    },
  );

  register(
    "apply_project_import",
    {
      title: "Apply project import",
      description:
        "Imports a project bundle previously previewed with preview_project_import. Side effect: writes the project and all its records in one transaction. Requires the preview's confirmation token.",
      department: "security_gate",
      inputSchema: {
        bundle: z.record(z.string(), z.unknown()).describe("The exact bundle that was previewed."),
        confirmationToken: z.string().describe("Token from preview_project_import."),
      },
    },
    (input) => {
      const bundle = importExport.applyImport(input.bundle, input.confirmationToken);
      return {
        text: `Imported project "${bundle.project.name}" with ${bundle.tasks.length} task(s).`,
        payload: {
          project: bundle.project,
          counts: {
            tasks: bundle.tasks.length,
            decisions: bundle.decisions.length,
            artifacts: bundle.artifacts.length,
            checkpoints: bundle.checkpoints.length,
          },
        },
      };
    },
  );

  // ----------------------------------------------------------- dashboard app
  //
  // The dashboard tools are registered outside the event-wrapped helper on
  // purpose: they are pure state reads for rendering the UI. Recording an
  // event for every dashboard refresh would flood the timeline with
  // self-observation noise (docs/MCP_OBSERVABILITY_MODEL.md: "Do not flood
  // the host"; decision D-022). They mutate nothing.

  const uiState = createUiStateService(ctx, activity, SERVER_VERSION);

  registerAppTool(
    server,
    "open_mission_control",
    {
      title: "Open Mission Control",
      description:
        "Opens the Mission Control dashboard: project header, stage, exact activity panel, and event timeline. No side effects. Shows only saved project state and observable Mission Control events.",
      inputSchema: {},
      _meta: {
        ui: { resourceUri: DASHBOARD_RESOURCE_URI },
        missionControl: { department: "command_core" },
      },
    },
    () => {
      try {
        const state = uiState.buildDashboardState();
        return okResult(
          state.activeProject
            ? `Mission Control opened. Active project: "${state.activeProject.name}" (stage ${state.activeProject.currentStage}).`
            : "Mission Control opened. No active project yet.",
          { state },
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_mission_control_state",
    {
      title: "Get Mission Control state",
      description:
        "Returns the dashboard read model: projects, active project, tasks, decisions, latest checkpoint, current activity, and recent event timeline. No side effects.",
      inputSchema: {},
      _meta: { missionControl: { department: "command_core" } },
    },
    () => {
      try {
        const state = uiState.buildDashboardState();
        return okResult(`Mission Control state generated at ${state.generatedAt}.`, { state });
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_diagnostics",
    {
      title: "Get diagnostics",
      description:
        "Health check for Mission Control: version, database path and schema, writable storage, dashboard availability, and recent safe errors. Side effect: writes and removes one small probe file in the data directory. Never includes secrets.",
      inputSchema: {},
      _meta: { missionControl: { department: "command_core" } },
    },
    () => {
      try {
        const dbPath = databaseFilePath();
        let appliedMigrations = 0;
        try {
          const row = ctx.db.prepare("SELECT COUNT(*) AS applied FROM migrations").get() as
            { applied: number } | undefined;
          appliedMigrations = row?.applied ?? 0;
        } catch {
          appliedMigrations = 0;
        }

        let storageWritable = false;
        try {
          const probe = path.join(resolveDataRoot(), `.probe-${process.pid}`);
          fs.writeFileSync(probe, "ok");
          fs.rmSync(probe);
          storageWritable = true;
        } catch {
          storageWritable = false;
        }

        let dashboard: { available: boolean; detail: string };
        try {
          dashboard = { available: true, detail: resolveDashboardHtmlPath() };
        } catch (error) {
          dashboard = {
            available: false,
            detail: isDomainError(error) ? error.message : "unknown error",
          };
        }

        const recentErrors = activity
          .getTimeline(100)
          .filter((e) => e.status === "failed")
          .slice(0, 5)
          .map((e) => ({
            toolName: e.toolName,
            errorCode: e.errorCode,
            errorSummary: e.errorSummary,
            at: e.updatedAt,
          }));

        const diagnostics = {
          serverVersion: SERVER_VERSION,
          databasePath: dbPath,
          appliedMigrations,
          expectedMigrations: MIGRATIONS.length,
          storageWritable,
          dashboard,
          dataDirectories: {
            root: resolveDataRoot(),
            exports: exportsDirPath(),
            backups: backupsDirPath(),
          },
          recentErrors,
        };
        return okResult(
          `Diagnostics: schema ${appliedMigrations}/${MIGRATIONS.length}, storage ${storageWritable ? "writable" : "NOT WRITABLE"}, dashboard ${dashboard.available ? "available" : "unavailable"}.`,
          { diagnostics },
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  registerAppResource(
    server,
    "Mission Control dashboard",
    DASHBOARD_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    () => {
      // Read lazily so the server starts even before the UI is built; the
      // error carries a recovery hint instead of hiding behind a blank frame.
      const html = readDashboardHtml();
      return {
        contents: [{ uri: DASHBOARD_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}
