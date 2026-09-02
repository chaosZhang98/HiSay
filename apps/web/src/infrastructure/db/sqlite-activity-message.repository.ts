import type Database from "better-sqlite3";
import type { UUID } from "@hisay/shared";
import type { IActivityMessageRepository } from "../../domain/repositories";
import { ActivityMessage } from "../../domain/activity-message";

interface ActivityRow {
  id: string;
  conversation_id: string;
  activity_type: string;
  content_json: string;
  created_at: string;
}

export class SQLiteActivityMessageRepository implements IActivityMessageRepository {
  constructor(private readonly db: Database.Database) {}

  async findByConversationId(conversationId: UUID): Promise<ActivityMessage[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM activity_messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`,
      )
      .all(conversationId) as ActivityRow[];

    return rows.map(rowToActivity);
  }

  async save(activity: ActivityMessage): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO activity_messages (id, conversation_id, activity_type, content_json, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           conversation_id = excluded.conversation_id,
           activity_type = excluded.activity_type,
           content_json = excluded.content_json`,
      )
      .run(
        activity.id,
        activity.conversationId,
        activity.activityType,
        JSON.stringify(activity.content),
        activity.createdAt.toISOString(),
      );
  }

  async deleteByConversationId(conversationId: UUID): Promise<void> {
    this.db
      .prepare("DELETE FROM activity_messages WHERE conversation_id = ?")
      .run(conversationId);
  }
}

function rowToActivity(row: ActivityRow): ActivityMessage {
  let content: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(row.content_json);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      content = parsed as Record<string, unknown>;
    }
  } catch {
    content = {};
  }

  return new ActivityMessage({
    id: row.id,
    conversationId: row.conversation_id,
    activityType: row.activity_type,
    content,
    createdAt: new Date(row.created_at),
  });
}
