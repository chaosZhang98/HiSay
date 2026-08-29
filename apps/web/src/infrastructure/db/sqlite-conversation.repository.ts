import type Database from "better-sqlite3";
import type { UUID } from "@agent/shared";
import type { IConversationRepository } from "../../domain/repositories";
import { Conversation } from "../../domain/conversation";

interface ConversationRow {
  id: string;
  title: string;
  device_id: string | null;
  created_at: string;
  updated_at: string;
}

export class SQLiteConversationRepository implements IConversationRepository {
  constructor(private readonly db: Database.Database) {}

  private rowToConversation(row: ConversationRow): Conversation {
    return new Conversation({
      id: row.id,
      title: row.title,
      deviceId: row.device_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }

  async findById(id: UUID): Promise<Conversation | null> {
    const row = this.db
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(id) as ConversationRow | undefined;

    if (!row) return null;
    return this.rowToConversation(row);
  }

  async findLatestByDeviceId(deviceId: string): Promise<Conversation | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM conversations
         WHERE device_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(deviceId) as ConversationRow | undefined;

    if (!row) return null;
    return this.rowToConversation(row);
  }

  async findAllByDeviceId(deviceId: string): Promise<Conversation[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM conversations
         WHERE device_id = ?
         ORDER BY updated_at DESC`,
      )
      .all(deviceId) as ConversationRow[];

    return rows.map((row) => this.rowToConversation(row));
  }

  async findAll(): Promise<Conversation[]> {
    const rows = this.db
      .prepare("SELECT * FROM conversations ORDER BY updated_at DESC")
      .all() as ConversationRow[];

    return rows.map((row) => this.rowToConversation(row));
  }

  async save(conversation: Conversation): Promise<void> {
    // 用 ON CONFLICT 原地更新而非 INSERT OR REPLACE：
    // REPLACE 会先删除旧行再插入，触发 messages 的 ON DELETE CASCADE 清空整个会话的消息。
    this.db
      .prepare(
        `INSERT INTO conversations (id, title, device_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           device_id = excluded.device_id,
           updated_at = excluded.updated_at`,
      )
      .run(
        conversation.id,
        conversation.title,
        conversation.deviceId,
        conversation.createdAt.toISOString(),
        conversation.updatedAt.toISOString(),
      );
  }

  async delete(id: UUID): Promise<void> {
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  }
}
