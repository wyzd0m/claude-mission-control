import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openDatabase } from "../storage/database.js";
import { databaseFilePath } from "../storage/paths.js";
import { createServiceContext } from "../services/service-context.js";
import { createActivityEventService } from "../services/activity-event-service.js";
import { createMissionControlServer, SERVER_VERSION } from "./server.js";

// Stdio entry point: how Claude Desktop (and MCP Inspector) launch the
// server. stdout carries the protocol; every log line goes to stderr and
// never contains conversation content or secrets.

async function main() {
  const dbPath = databaseFilePath();
  const { db, appliedMigrations, preMigrationBackupPath } = openDatabase(dbPath);
  console.error(
    `[mission-control] v${SERVER_VERSION} starting (db: ${dbPath}` +
      (appliedMigrations.length > 0
        ? `, applied migrations: ${appliedMigrations.join(", ")}`
        : "") +
      `)`,
  );
  if (preMigrationBackupPath !== null) {
    console.error(`[mission-control] pre-migration backup written to ${preMigrationBackupPath}`);
  }

  const ctx = createServiceContext(db);
  const activity = createActivityEventService(ctx);
  // After a restart no operation is actually running and confirmation tokens
  // are gone; leaving events open would be dishonest.
  const orphaned = activity.cancelOrphanedOpenEvents();
  if (orphaned > 0) {
    console.error(
      `[mission-control] cancelled ${orphaned} orphaned open event(s) from a previous run`,
    );
  }
  const server = createMissionControlServer(ctx, { activity });
  await server.connect(new StdioServerTransport());
  console.error("[mission-control] connected over stdio");
}

main().catch((error) => {
  console.error("[mission-control] fatal startup error", error);
  process.exit(1);
});
