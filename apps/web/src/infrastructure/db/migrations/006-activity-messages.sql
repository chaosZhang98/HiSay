CREATE TABLE IF NOT EXISTS activity_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_messages_conversation_id
  ON activity_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_activity_messages_created_at
  ON activity_messages(created_at);
