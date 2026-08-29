-- 关联会话与设备：客户端注册后按 device_id 恢复会话
ALTER TABLE conversations ADD COLUMN device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_conversations_device_id ON conversations(device_id);
