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
