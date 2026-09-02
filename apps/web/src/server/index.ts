import { config } from "dotenv";
config();

import { createDatabase } from "../infrastructure/db/database";
import { SQLiteConversationRepository } from "../infrastructure/db/sqlite-conversation.repository";
import { SQLiteMessageRepository } from "../infrastructure/db/sqlite-message.repository";
import { SQLiteActivityMessageRepository } from "../infrastructure/db/sqlite-activity-message.repository";
import { SQLiteScheduledTaskRepository } from "../infrastructure/db/sqlite-scheduled-task.repository";
import { SQLiteTaskRunRepository } from "../infrastructure/db/sqlite-task-run.repository";
import { SQLiteDynamicDataStore } from "../infrastructure/db/sqlite-dynamic-data-store";
import { AppDataService } from "../application/app-data.service";
import { TaskToolService } from "../application/task-tool.service";
import { ConversationUseCase } from "../application/conversation.usecase";
import { TaskUseCase } from "../application/task.usecase";
import { RunConversationUseCase } from "../application/run-conversation.usecase";
import { HandleSurfaceActionUseCase } from "../application/handle-surface-action.usecase";
import { RunScheduledTaskUseCase } from "../application/run-scheduled-task.usecase";
import { PiAgentRuntime } from "../infrastructure/agent/pi/pi-agent.runtime";
import { CronScheduler } from "../infrastructure/cron/scheduler";
import { ArchiveService } from "../infrastructure/cron/archive.service";
import { startHttpServer } from "../infrastructure/http/create-http-server";

const PORT = Number(process.env.PORT ?? process.env.WS_PORT ?? 8080);
const DB_PATH = process.env.DB_PATH ?? "./data/agent.db";
const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? "0 9 * * *";

const db = createDatabase(DB_PATH);
console.log(`[db] connected to ${DB_PATH}`);

const conversations = new SQLiteConversationRepository(db);
const messages = new SQLiteMessageRepository(db);
const activities = new SQLiteActivityMessageRepository(db);
const scheduledTasks = new SQLiteScheduledTaskRepository(db);
const taskRuns = new SQLiteTaskRunRepository(db);
const dynamicDataStore = new SQLiteDynamicDataStore(db);
const appDataService = new AppDataService(dynamicDataStore);
const taskToolService = new TaskToolService(scheduledTasks);

const agentRuntime = new PiAgentRuntime(appDataService, taskToolService);
const conversationUseCase = new ConversationUseCase(conversations, messages, activities);
const taskUseCase = new TaskUseCase(scheduledTasks, taskRuns);
const runConversation = new RunConversationUseCase(
  conversations,
  messages,
  activities,
  agentRuntime,
);
const handleSurfaceAction = new HandleSurfaceActionUseCase(conversations, runConversation);
const runTask = new RunScheduledTaskUseCase(
  scheduledTasks,
  taskRuns,
  agentRuntime,
  conversations,
  messages,
);

const httpServer = startHttpServer(
  {
    conversations: conversationUseCase,
    tasks: taskUseCase,
    runConversation,
    handleSurfaceAction,
  },
  PORT,
);
console.log(`[http] listening on port ${PORT}`);

const scheduler = new CronScheduler(scheduledTasks, runTask, async (result) => {
  console.log(`[cron] task ${result.taskId} → ${result.status}`);
  // 结果已由 RunScheduledTaskUseCase 回写来源会话；客户端通过 GET /tasks/alerts 拉取并本地通知。
});

scheduler.start(CRON_SCHEDULE);
console.log(`[cron] scheduler started with schedule "${CRON_SCHEDULE}"`);

const archiveService = new ArchiveService(messages, db);
archiveService.start();
console.log("[archive] archive service started");

process.on("SIGTERM", () => {
  scheduler.stop();
  archiveService.stop();
  httpServer.close(() => {
    db.close();
    process.exit(0);
  });
});
