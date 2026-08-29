import type Database from "better-sqlite3";
import type { IScheduledTaskRepository } from "../../domain/repositories";
import { ScheduledTask } from "../../domain/scheduled-task";

interface ScheduledTaskRow {
  id: string;
  cron_expression: string;
  prompt: string;
  is_enabled: number;
  device_id: string | null;
  conversation_id: string | null;
  last_run_at: string | null;
  created_at: string;
}

export class SQLiteScheduledTaskRepository implements IScheduledTaskRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToTask(row: ScheduledTaskRow): ScheduledTask {
    return new ScheduledTask({
      id: row.id,
      cronExpression: row.cron_expression,
      prompt: row.prompt,
      isEnabled: row.is_enabled === 1,
      deviceId: row.device_id ?? null,
      conversationId: row.conversation_id ?? null,
      lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
      createdAt: new Date(row.created_at),
    });
  }

  async findById(id: string): Promise<ScheduledTask | null> {
    const row = this.db
      .prepare("SELECT * FROM scheduled_tasks WHERE id = ?")
      .get(id) as ScheduledTaskRow | undefined;

    if (!row) return null;
    return this.rowToTask(row);
  }

  async findByDeviceId(deviceId: string): Promise<ScheduledTask[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM scheduled_tasks
         WHERE device_id = ?
         ORDER BY created_at DESC`,
      )
      .all(deviceId) as ScheduledTaskRow[];

    return rows.map((row) => this.rowToTask(row));
  }

  async findDue(before: Date): Promise<ScheduledTask[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM scheduled_tasks
         WHERE is_enabled = 1 AND (last_run_at IS NULL OR last_run_at < ?)`,
      )
      .all(before.toISOString()) as ScheduledTaskRow[];

    return rows.map((row) => this.rowToTask(row));
  }

  async findEnabled(): Promise<ScheduledTask[]> {
    const rows = this.db
      .prepare("SELECT * FROM scheduled_tasks WHERE is_enabled = 1")
      .all() as ScheduledTaskRow[];

    return rows.map((row) => this.rowToTask(row));
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM scheduled_tasks WHERE id = ?").run(id);
  }

  async save(task: ScheduledTask): Promise<void> {
    const props = task.toProps();
    // 用 ON CONFLICT 原地更新而非 INSERT OR REPLACE：
    // REPLACE 会先删除旧行再插入，触发 task_runs 的 ON DELETE CASCADE 清空该任务的执行历史。
    this.db
      .prepare(
        `INSERT INTO scheduled_tasks
           (id, cron_expression, prompt, is_enabled, device_id, conversation_id, last_run_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           cron_expression = excluded.cron_expression,
           prompt = excluded.prompt,
           is_enabled = excluded.is_enabled,
           device_id = excluded.device_id,
           conversation_id = excluded.conversation_id,
           last_run_at = excluded.last_run_at`,
      )
      .run(
        task.id,
        task.cronExpression,
        task.prompt,
        task.isEnabled ? 1 : 0,
        props.deviceId,
        props.conversationId,
        props.lastRunAt ? props.lastRunAt.toISOString() : null,
        props.createdAt.toISOString(),
      );
  }
}
