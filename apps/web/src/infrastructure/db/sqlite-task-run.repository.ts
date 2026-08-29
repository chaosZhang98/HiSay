import type Database from "better-sqlite3";
import type { UUID } from "@agent/shared";
import type { ITaskRunRepository } from "../../domain/repositories";
import { TaskRun } from "../../domain/task-run";
import type { TaskRunStatus } from "../../domain/task-run";

interface TaskRunRow {
  id: string;
  task_id: string;
  status: string;
  output: string | null;
  error: string | null;
  run_at: string;
  created_at: string;
}

export class SQLiteTaskRunRepository implements ITaskRunRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToRun(row: TaskRunRow): TaskRun {
    return new TaskRun({
      id: row.id,
      taskId: row.task_id,
      status: row.status as TaskRunStatus,
      output: row.output,
      error: row.error,
      runAt: new Date(row.run_at),
      createdAt: new Date(row.created_at),
    });
  }

  async save(run: TaskRun): Promise<void> {
    const props = run.toProps();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO task_runs (id, task_id, status, output, error, run_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        props.id,
        props.taskId,
        props.status,
        props.output,
        props.error,
        props.runAt.toISOString(),
        props.createdAt.toISOString(),
      );
  }

  async findLatestByTaskId(taskId: UUID): Promise<TaskRun | null> {
    const row = this.db
      .prepare("SELECT * FROM task_runs WHERE task_id = ? ORDER BY run_at DESC LIMIT 1")
      .get(taskId) as TaskRunRow | undefined;

    if (!row) return null;
    return this.rowToRun(row);
  }

  async findByTaskId(taskId: UUID): Promise<TaskRun[]> {
    const rows = this.db
      .prepare("SELECT * FROM task_runs WHERE task_id = ? ORDER BY run_at DESC")
      .all(taskId) as TaskRunRow[];

    return rows.map((row) => this.rowToRun(row));
  }
}
