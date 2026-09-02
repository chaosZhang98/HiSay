import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function createDatabase(dbPath: string) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureMigrationsTable(db);
  runMigrations(db);
  return db;
}

function ensureMigrationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function runMigrations(db: Database.Database) {
  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");
  const files = [
    "001-init.sql",
    "002-task-runs.sql",
    "003-conversation-device.sql",
    "004-app-store.sql",
    "005-task-context.sql",
    "006-activity-messages.sql",
  ];
  const applied = db
    .prepare("SELECT filename FROM _migrations")
    .all() as { filename: string }[];
  const appliedSet = new Set(applied.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    db.exec(sql);
    db.prepare("INSERT INTO _migrations (filename) VALUES (?)").run(file);
  }
}
