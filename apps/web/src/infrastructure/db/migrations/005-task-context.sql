-- 任务归属与来源：device_id 隔离用户，conversation_id 记录创建任务的会话，
-- 用于任务执行结果回写对话流。
ALTER TABLE scheduled_tasks ADD COLUMN device_id TEXT;
ALTER TABLE scheduled_tasks ADD COLUMN conversation_id TEXT;

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_device_id ON scheduled_tasks(device_id);
