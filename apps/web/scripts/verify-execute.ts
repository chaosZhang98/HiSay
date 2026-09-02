import { config } from "dotenv";
config();

import Database from "better-sqlite3";
import { SQLiteConversationRepository } from "../src/infrastructure/db/sqlite-conversation.repository";
import { SQLiteMessageRepository } from "../src/infrastructure/db/sqlite-message.repository";
import { SQLiteScheduledTaskRepository } from "../src/infrastructure/db/sqlite-scheduled-task.repository";
import { SQLiteTaskRunRepository } from "../src/infrastructure/db/sqlite-task-run.repository";
import { PiAgentRuntime } from "../src/infrastructure/agent/pi/pi-agent.runtime";
import { RunScheduledTaskUseCase } from "../src/application/run-scheduled-task.usecase";
import { ScheduledTask } from "../src/domain/scheduled-task";
import { Conversation } from "../src/domain/conversation";

const db = new Database("./data/agent.db");
db.pragma("journal_mode = WAL");
const tasks = new SQLiteScheduledTaskRepository(db);
const taskRuns = new SQLiteTaskRunRepository(db);
const conversations = new SQLiteConversationRepository(db);
const messages = new SQLiteMessageRepository(db);
const agent = new PiAgentRuntime();
const useCase = new RunScheduledTaskUseCase(tasks, taskRuns, agent, conversations, messages, 90_000);

const dump = () =>
  db.prepare("SELECT id, task_id, status, run_at FROM task_runs").all();

// 建一个带来源会话的任务，验证结果能回写会话
const conversationId = crypto.randomUUID();
await conversations.save(
  new Conversation({
    id: conversationId,
    title: "验证会话",
    deviceId: "verify-device",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
);

const task = new ScheduledTask({
  id: crypto.randomUUID(),
  cronExpression: "* * * * *",
  prompt: "请用一句话回答：你好吗？",
  isEnabled: true,
  deviceId: "verify-device",
  conversationId,
  lastRunAt: undefined,
  createdAt: new Date(),
});
await tasks.save(task);
console.log("[1] task saved, task_runs:", JSON.stringify(dump()));

const result = await useCase.execute(task.id);
console.log("[2] execute done:", JSON.stringify(result));
console.log("[3] task_runs after execute:", JSON.stringify(dump()));

const writtenBack = db
  .prepare("SELECT id, role, content FROM messages WHERE conversation_id = ?")
  .all(conversationId);
console.log("[4] messages written back to conversation:", JSON.stringify(writtenBack));

// 清理
db.prepare("DELETE FROM task_runs").run();
db.prepare("DELETE FROM messages").run();
db.prepare("DELETE FROM conversations").run();
db.prepare("DELETE FROM scheduled_tasks").run();
console.log("[5] cleaned");
db.close();
