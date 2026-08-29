import { config } from "dotenv";
config();

import { createDatabase } from "../infrastructure/db/database";
import { SQLiteConversationRepository } from "../infrastructure/db/sqlite-conversation.repository";
import { SQLiteMessageRepository } from "../infrastructure/db/sqlite-message.repository";
import { SQLiteScheduledTaskRepository } from "../infrastructure/db/sqlite-scheduled-task.repository";
import { SQLiteTaskRunRepository } from "../infrastructure/db/sqlite-task-run.repository";
import { SQLiteDynamicDataStore } from "../infrastructure/db/sqlite-dynamic-data-store";
import { AppDataService } from "../application/app-data.service";
import { TaskToolService } from "../application/task-tool.service";
import { PiAgentGateway } from "../infrastructure/agent/pi-agent.gateway";
import { SendMessageUseCase } from "../application/send-message.usecase";
import { RunScheduledTaskUseCase } from "../application/run-scheduled-task.usecase";
import { CronScheduler } from "../infrastructure/cron/scheduler";
import { ArchiveService } from "../infrastructure/cron/archive.service";
import { ConnectionManager } from "../infrastructure/websocket/connection-manager";
import { startWebSocketServer, toTaskItem } from "../infrastructure/websocket/server";

const PORT = Number(process.env.WS_PORT ?? 8080);
const DB_PATH = process.env.DB_PATH ?? "./data/agent.db";
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? "0 9 * * *";

const db = createDatabase(DB_PATH);
console.log(`[db] connected to ${DB_PATH}`);

const conversations = new SQLiteConversationRepository(db);
const messages = new SQLiteMessageRepository(db);
const scheduledTasks = new SQLiteScheduledTaskRepository(db);
const taskRuns = new SQLiteTaskRunRepository(db);
const dynamicDataStore = new SQLiteDynamicDataStore(db);
const appDataService = new AppDataService(dynamicDataStore);

const connectionManager = new ConnectionManager();

const taskToolService = new TaskToolService(scheduledTasks, {
  // Agent 通过工具创建任务后，实时广播 task_changed，客户端任务列表即时刷新
  onTaskChanged: (task) => {
    if (!task.deviceId) return;
    connectionManager.sendToDevice(task.deviceId, {
      type: "task_changed",
      task: toTaskItem(task),
      timestamp: new Date().toISOString(),
    });
  },
});

const agentGateway = new PiAgentGateway(appDataService, taskToolService);
const sendMessage = new SendMessageUseCase(conversations, messages, agentGateway);
const runTask = new RunScheduledTaskUseCase(
  scheduledTasks,
  taskRuns,
  agentGateway,
  conversations,
  messages,
);

const wss = startWebSocketServer(
  {
    sendMessage,
    conversations,
    messages,
    scheduledTasks,
    taskRuns,
    connectionManager,
  },
  PORT,
);
console.log(`[ws] listening on port ${PORT}`);

const scheduler = new CronScheduler(
  scheduledTasks,
  runTask,
  async (result) => {
    console.log(`[cron] task ${result.taskId} → ${result.status}`);

    // 定向推送回写消息：任务执行结论作为一条 agent 消息实时展示在来源会话
    if (result.conversationId && result.messageId && result.deviceId) {
      const message = await messages.findById(result.messageId);
      if (message) {
        connectionManager.sendToDevice(result.deviceId, {
          type: "task_result_message",
          conversationId: result.conversationId,
          message: {
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 广播通知事件（驱动 iOS 本地通知）
    connectionManager.broadcast({
      type: "task_run_result",
      taskId: result.taskId,
      runId: result.runId,
      status: result.status,
      output: result.output,
      error: result.error,
      timestamp: new Date().toISOString(),
    });
  },
);

scheduler.start(CRON_SCHEDULE);
console.log(`[cron] scheduler started with schedule "${CRON_SCHEDULE}"`);

const archiveService = new ArchiveService(messages, db);
archiveService.start();
console.log("[archive] archive service started");

process.on("SIGTERM", () => {
  scheduler.stop();
  archiveService.stop();
  connectionManager.stop();
  wss.close(() => {
    db.close();
    process.exit(0);
  });
});