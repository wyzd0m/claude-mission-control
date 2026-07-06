import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openDatabase } from "../storage/database.js";
import { databaseFilePath } from "../storage/paths.js";
import { createServiceContext } from "../services/service-context.js";
import { createMissionControlServer, SERVER_VERSION } from "./server.js";

// Stdio entry point: how Claude Desktop (and MCP Inspector) launch the
// server. stdout carries the protocol; every log line goes to stderr and
// never contains conversation content or secrets.

async function main() {
  const dbPath = databaseFilePath();
  const { db, appliedMigrations } = openDatabase(dbPath);
  console.error(
    `[mission-control] v${SERVER_VERSION} starting (db: ${dbPath}` +
      (appliedMigrations.length > 0
        ? `, applied migrations: ${appliedMigrations.join(", ")}`
        : "") +
      `)`,
  );

  const ctx = createServiceContext(db);
  const server = createMissionControlServer(ctx);
  await server.connect(new StdioServerTransport());
  console.error("[mission-control] connected over stdio");
}

main().catch((error) => {
  console.error("[mission-control] fatal startup error", error);
  process.exit(1);
});
