// Server side of Claude Mission Control.
//
// Architecture contract (docs/SYSTEM_ARCHITECTURE.md): this package owns the
// storage adapter (SQLite via node:sqlite, migrations, repositories), and —
// in later phases — application services, the MCP adapter, and the activity
// event service. It depends on the domain core and never imports UI
// frameworks. ESLint enforces this.

export const SERVER_PACKAGE_NAME = "@mission-control/server";

export { openDatabase, backupDatabase, withTransaction } from "./storage/database.js";
export { MIGRATIONS, runMigrations } from "./storage/migrations.js";
export {
  resolveDataRoot,
  databaseFilePath,
  backupsDirPath,
  exportsDirPath,
  logsDirPath,
} from "./storage/paths.js";
export {
  SqliteProjectRepository,
  SqliteTaskRepository,
  SqliteDecisionRepository,
  SqliteArtifactRepository,
  SqliteCheckpointRepository,
  SqliteActivityEventRepository,
  SqliteSettingsRepository,
} from "./storage/repositories.js";
export { buildProjectExport, importProject } from "./storage/import-export.js";
export {
  createServiceContext,
  requireProject,
  type ServiceContext,
} from "./services/service-context.js";
export { ApprovalService, hashApprovalPayload } from "./services/approval-service.js";
export { createProjectService, type ProjectBrief } from "./services/project-service.js";
export { createTaskService, type BulkUpdatePreview } from "./services/task-service.js";
export { createRecordService } from "./services/record-service.js";
export {
  createContextPackageService,
  type ContextPackage,
} from "./services/context-package-service.js";
export { createImportExportService, type ImportPreview } from "./services/import-export-service.js";
export {
  createActivityEventService,
  IDLE_MESSAGE,
  type ActivityEventService,
  type CurrentActivity,
} from "./services/activity-event-service.js";
export { createMissionControlServer, SERVER_VERSION } from "./mcp/server.js";
