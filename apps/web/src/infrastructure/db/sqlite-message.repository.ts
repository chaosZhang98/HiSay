import type Database from "better-sqlite3";
import { Buffer } from "node:buffer";
import zlib from "node:zlib";
import type { UUID } from "@hisay/shared";
import type { IMessageRepository } from "../../domain/repositories";
import { Message } from "../../domain/message";
import type { MessageRole } from "../../domain/message";

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string | null;
  is_archived: number;
  created_at: string;
}

export class SQLiteMessageRepository implements IMessageRepository {
  constructor(private readonly db: Database.Database) {}

  async findById(id: UUID): Promise<Message | null> {
    const row = this.db
      .prepare("SELECT * FROM messages WHERE id = ?")
      .get(id) as MessageRow | undefined;

    if (!row) return null;
    return new Message({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as MessageRole,
      content: row.content ?? "",
      createdAt: new Date(row.created_at),
    });
  }

  async findByConversationId(conversationId: UUID): Promise<Message[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM messages
         WHERE conversation_id = ? AND is_archived = 0
         ORDER BY created_at ASC`,
      )
      .all(conversationId) as MessageRow[];

    return rows.map(
      (row) =>
        new Message({
          id: row.id,
          conversationId: row.conversation_id,
          role: row.role as MessageRole,
          content: row.content ?? "",
          createdAt: new Date(row.created_at),
        }),
    );
  }

  async findLatestByConversationId(conversationId: UUID): Promise<Message | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM messages
         WHERE conversation_id = ? AND is_archived = 0
         ORDER BY created_at DESC
         LIMIT 1`,
      )
      .get(conversationId) as MessageRow | undefined;

    if (!row) return null;
    return new Message({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role as MessageRole,
      content: row.content ?? "",
      createdAt: new Date(row.created_at),
    });
  }

  async findArchivedByConversationId(conversationId: UUID): Promise<Message[]> {
    const rows = this.db
      .prepare(
        `SELECT a.message_id, a.compressed_content, m.conversation_id, m.role, m.created_at
         FROM archives a
         JOIN messages m ON m.id = a.message_id
         WHERE m.conversation_id = ? AND m.is_archived = 1
         ORDER BY m.created_at ASC`,
      )
      .all(conversationId) as Array<{
      message_id: string;
      compressed_content: Buffer;
      conversation_id: string;
      role: string;
      created_at: string;
    }>;

    return rows.map(
      (row) =>
        new Message({
          id: row.message_id,
          conversationId: row.conversation_id,
          role: row.role as MessageRole,
          content: zlib.gunzipSync(row.compressed_content).toString("utf-8"),
          createdAt: new Date(row.created_at),
        }),
    );
  }

  async save(message: Message): Promise<void> {
    // 用 ON CONFLICT 原地更新而非 INSERT OR REPLACE：
    // REPLACE 会先删除旧行再插入，触发 archives 的 ON DELETE CASCADE 清空该消息的归档内容。
    this.db
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, is_archived, created_at)
         VALUES (?, ?, ?, ?, 0, ?)
         ON CONFLICT(id) DO UPDATE SET
           conversation_id = excluded.conversation_id,
           role = excluded.role,
           content = excluded.content,
           is_archived = 0`,
      )
      .run(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.createdAt.toISOString(),
      );
  }

  async deleteByConversationId(conversationId: UUID): Promise<void> {
    this.db
      .prepare("DELETE FROM messages WHERE conversation_id = ?")
      .run(conversationId);
  }

  async archiveBefore(date: Date): Promise<number> {
    const archiveBeforeDate = this.db.transaction(() => {
      const rows = this.db
        .prepare(
          `SELECT * FROM messages
           WHERE created_at < ? AND is_archived = 0`,
        )
        .all(date.toISOString()) as MessageRow[];

      const insertArchive = this.db.prepare(
        `INSERT OR REPLACE INTO archives (message_id, compressed_content, archived_at)
         VALUES (?, ?, ?)`,
      );

      const markArchived = this.db.prepare(
        `UPDATE messages SET is_archived = 1, content = NULL WHERE id = ?`,
      );

      const now = new Date().toISOString();

      for (const row of rows) {
        const compressed = zlib.gzipSync(
          Buffer.from(row.content ?? "", "utf-8"),
        );
        insertArchive.run(row.id, compressed, now);
        markArchived.run(row.id);
      }

      return rows.length;
    });

    return archiveBeforeDate();
  }
}
