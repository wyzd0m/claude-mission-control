import type { DatabaseSync } from "node:sqlite";

// Ordered, append-only migrations (docs/PRODUCT_REQUIREMENTS.md §8). Never
// edit an applied migration; add a new one. Each runs inside a transaction
// and is recorded in the `migrations` table.

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: 1,
    name: "initial-schema",
    sql: `
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        goal TEXT NOT NULL DEFAULT '',
        definition_of_done TEXT NOT NULL DEFAULT '',
        current_stage TEXT NOT NULL,
        status TEXT NOT NULL,
        revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        stage TEXT NOT NULL,
        blocked_reason TEXT,
        parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX idx_tasks_project ON tasks(project_id);

      CREATE TABLE decisions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        rationale TEXT NOT NULL DEFAULT '',
        alternatives_considered TEXT NOT NULL DEFAULT '[]',
        related_task_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_decisions_project ON decisions(project_id);

      CREATE TABLE artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'file',
        path_or_reference TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        related_task_ids TEXT NOT NULL DEFAULT '[]',
        verification_status TEXT NOT NULL,
        verification_note TEXT,
        verified_at TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_artifacts_project ON artifacts(project_id);

      CREATE TABLE checkpoints (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        summary TEXT NOT NULL,
        completed_work TEXT NOT NULL DEFAULT '[]',
        open_work TEXT NOT NULL DEFAULT '[]',
        decisions TEXT NOT NULL DEFAULT '[]',
        blockers TEXT NOT NULL DEFAULT '[]',
        recommended_next_action TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX idx_checkpoints_project ON checkpoints(project_id, created_at);

      CREATE TABLE activity_events (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        correlation_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        display_label TEXT NOT NULL,
        department TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        progress_current INTEGER,
        progress_total INTEGER,
        progress_message TEXT,
        related_task_ids TEXT NOT NULL DEFAULT '[]',
        requires_input INTEGER NOT NULL DEFAULT 0,
        result_summary TEXT,
        error_code TEXT,
        error_summary TEXT
      );
      CREATE INDEX idx_events_recency ON activity_events(started_at DESC);
      CREATE INDEX idx_events_project ON activity_events(project_id, started_at DESC);

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];

interface MigrationRow {
  id: number;
}

/** Applies pending migrations in order. Returns the ids that were applied. */
export function runMigrations(db: DatabaseSync): number[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db
    .prepare("SELECT id FROM migrations ORDER BY id")
    .all() as unknown as MigrationRow[];
  const applied = new Set(appliedRows.map((row) => row.id));
  const newlyApplied: number[] = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }
    db.exec("BEGIN");
    try {
      db.exec(migration.sql);
      db.prepare("INSERT INTO migrations (id, name, applied_at) VALUES (?, ?, ?)").run(
        migration.id,
        migration.name,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
      newlyApplied.push(migration.id);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return newlyApplied;
}
