import { WebSocketServer, WebSocket } from "ws";
import type {
  AguiMessage,
  RegisterEvent,
  UserMessageEvent,
  FetchHistoryEvent,
  FetchArchivedMessagesEvent,
  RenameConversationEvent,
  DeleteConversationEvent,
  CreateTaskEvent,
  ToggleTaskEvent,
  DeleteTaskEvent,
  FetchTaskRunsEvent,
  ScheduledTaskItem,
  TaskRunItem,
} from "@agent/shared";
import type { SendMessageUseCase } from "../../application/send-message.usecase";
import type {
  IConversationRepository,
  IMessageRepository,
  IScheduledTaskRepository,
  ITaskRunRepository,
} from "../../domain/repositories";
import { Conversation } from "../../domain/conversation";
import { ScheduledTask } from "../../domain/scheduled-task";
import { TaskRun } from "../../domain/task-run";
import { ConnectionManager } from "./connection-manager";

export interface WebSocketServerDeps {
  sendMessage: SendMessageUseCase;
  conversations: IConversationRepository;
  messages: IMessageRepository;
  scheduledTasks: IScheduledTaskRepository;
  taskRuns: ITaskRunRepository;
  connectionManager: ConnectionManager;
}

export function startWebSocketServer(deps: WebSocketServerDeps, port: number) {
  const {
    sendMessage,
    conversations,
    messages,
    scheduledTasks,
    taskRuns,
    connectionManager,
  } = deps;
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    let deviceId: string | null = null;

    ws.on("message", async (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as AguiMessage;
        await handleMessage(ws, message, {
          get deviceId() {
            return deviceId;
          },
          setDeviceId(id: string) {
            deviceId = id;
          },
          sendMessage,
          conversations,
          messages,
          scheduledTasks,
          taskRuns,
          connectionManager,
        });
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "PARSE_ERROR",
            message: err instanceof Error ? err.message : "Invalid message",
            timestamp: new Date().toISOString(),
          }),
        );
      }
    });

    ws.on("close", () => {
      if (deviceId) {
        connectionManager.unregister(deviceId);
      }
    });

    ws.send(
      JSON.stringify({
        type: "connection_status",
        status: "connected",
        timestamp: new Date().toISOString(),
      }),
    );
  });

  connectionManager.startHeartbeat();

  return wss;
}

interface HandlerContext {
  deviceId: string | null;
  setDeviceId(id: string): void;
  sendMessage: SendMessageUseCase;
  conversations: IConversationRepository;
  messages: IMessageRepository;
  scheduledTasks: IScheduledTaskRepository;
  taskRuns: ITaskRunRepository;
  connectionManager: ConnectionManager;
}

/** 领域 ScheduledTask -> 共享协议任务项。 */
export function toTaskItem(task: ScheduledTask): ScheduledTaskItem {
  const props = task.toProps();
  return {
    id: task.id,
    cronExpression: task.cronExpression,
    prompt: task.prompt,
    isEnabled: task.isEnabled,
    lastRunAt: props.lastRunAt?.toISOString(),
    createdAt: props.createdAt.toISOString(),
  };
}

/** 领域 TaskRun -> 共享协议执行记录项。 */
function toRunItem(run: TaskRun): TaskRunItem {
  const props = run.toProps();
  return {
    id: props.id,
    taskId: props.taskId,
    status: props.status,
    output: props.output ?? undefined,
    error: props.error ?? undefined,
    runAt: props.runAt.toISOString(),
  };
}

async function handleMessage(ws: WebSocket, message: AguiMessage, ctx: HandlerContext) {
  switch (message.type) {
    case "register": {
      const registerEvent = message as RegisterEvent;
      ctx.setDeviceId(registerEvent.deviceId);
      ctx.connectionManager.register(registerEvent.deviceId, ws);
      ctx.connectionManager.sendToDevice(registerEvent.deviceId, {
        type: "connection_status",
        status: "connected",
        timestamp: new Date().toISOString(),
      });

      // 恢复该设备的会话；无则新建。返回会话 ID 与历史消息，客户端据此恢复对话。
      let conversation = await ctx.conversations.findLatestByDeviceId(
        registerEvent.deviceId,
      );
      if (!conversation) {
        conversation = new Conversation({
          id: crypto.randomUUID(),
          title: "新会话",
          deviceId: registerEvent.deviceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await ctx.conversations.save(conversation);
      }

      const history = await ctx.messages.findByConversationId(conversation.id);
      ws.send(
        JSON.stringify({
          type: "session_info",
          conversationId: conversation.id,
          messages: history.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "fetch_history": {
      const fetchEvent = message as FetchHistoryEvent;
      const history = await ctx.messages.findByConversationId(
        fetchEvent.conversationId,
      );
      ws.send(
        JSON.stringify({
          type: "history_messages",
          conversationId: fetchEvent.conversationId,
          messages: history.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "fetch_archived_messages": {
      const archiveEvent = message as FetchArchivedMessagesEvent;
      if (!ctx.deviceId) break;
      const archived = await ctx.messages.findArchivedByConversationId(
        archiveEvent.conversationId,
      );
      ws.send(
        JSON.stringify({
          type: "archived_messages",
          conversationId: archiveEvent.conversationId,
          messages: archived.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "fetch_conversations": {
      if (!ctx.deviceId) break;

      const conversations = await ctx.conversations.findAllByDeviceId(
        ctx.deviceId,
      );
      const items: { id: string; title: string; updatedAt: string; preview?: string }[] = [];
      for (const conv of conversations) {
        const last = await ctx.messages.findLatestByConversationId(conv.id);
        items.push({
          id: conv.id,
          title: conv.title,
          updatedAt: conv.updatedAt.toISOString(),
          preview: last ? last.content.slice(0, 50) : undefined,
        });
      }

      ws.send(
        JSON.stringify({
          type: "conversation_list",
          conversations: items,
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "create_conversation": {
      if (!ctx.deviceId) break;

      const conversation = new Conversation({
        id: crypto.randomUUID(),
        title: "新会话",
        deviceId: ctx.deviceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await ctx.conversations.save(conversation);

      ws.send(
        JSON.stringify({
          type: "session_info",
          conversationId: conversation.id,
          messages: [],
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "rename_conversation": {
      const evt = message as RenameConversationEvent;
      if (!ctx.deviceId) break;
      const conv = await ctx.conversations.findById(evt.conversationId);
      if (!conv) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "CONVERSATION_NOT_FOUND",
            message: "Conversation not found",
            timestamp: new Date().toISOString(),
          }),
        );
        break;
      }
      const title = evt.title.trim() || "新会话";
      const updated = conv.rename(title);
      await ctx.conversations.save(updated);
      const last = await ctx.messages.findLatestByConversationId(updated.id);
      ws.send(
        JSON.stringify({
          type: "conversation_changed",
          conversation: {
            id: updated.id,
            title: updated.title,
            updatedAt: updated.updatedAt.toISOString(),
            preview: last ? last.content.slice(0, 50) : undefined,
          },
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "delete_conversation": {
      const evt = message as DeleteConversationEvent;
      if (!ctx.deviceId) break;
      await ctx.messages.deleteByConversationId(evt.conversationId);
      await ctx.conversations.delete(evt.conversationId);
      ws.send(
        JSON.stringify({
          type: "conversation_changed",
          conversation: {
            id: evt.conversationId,
            title: "",
            updatedAt: new Date().toISOString(),
          },
          deleted: true,
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "create_task": {
      const evt = message as CreateTaskEvent;
      if (!evt.cronExpression || !evt.prompt) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "INVALID_TASK",
            message: "cronExpression and prompt are required",
            timestamp: new Date().toISOString(),
          }),
        );
        break;
      }
      const task = new ScheduledTask({
        id: crypto.randomUUID(),
        cronExpression: evt.cronExpression,
        prompt: evt.prompt,
        isEnabled: true,
        deviceId: ctx.deviceId,
        conversationId: null,
        createdAt: new Date(),
      });
      await ctx.scheduledTasks.save(task);
      ws.send(
        JSON.stringify({
          type: "task_changed",
          task: toTaskItem(task),
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "list_tasks": {
      const tasks = ctx.deviceId
        ? await ctx.scheduledTasks.findByDeviceId(ctx.deviceId)
        : [];
      ws.send(
        JSON.stringify({
          type: "task_list",
          tasks: tasks.map(toTaskItem),
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "toggle_task": {
      const evt = message as ToggleTaskEvent;
      const task = await ctx.scheduledTasks.findById(evt.taskId);
      if (!task) {
        ws.send(
          JSON.stringify({
            type: "error",
            code: "TASK_NOT_FOUND",
            message: "ScheduledTask not found",
            timestamp: new Date().toISOString(),
          }),
        );
        break;
      }
      const toggled = new ScheduledTask({
        ...task.toProps(),
        isEnabled: !task.isEnabled,
      });
      await ctx.scheduledTasks.save(toggled);
      ws.send(
        JSON.stringify({
          type: "task_changed",
          task: toTaskItem(toggled),
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "delete_task": {
      const evt = message as DeleteTaskEvent;
      await ctx.scheduledTasks.delete(evt.taskId);
      ws.send(
        JSON.stringify({
          type: "task_changed",
          task: {
            id: evt.taskId,
            cronExpression: "",
            prompt: "",
            isEnabled: false,
            createdAt: new Date().toISOString(),
          },
          deleted: true,
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "fetch_task_runs": {
      const evt = message as FetchTaskRunsEvent;
      const runs = await ctx.taskRuns.findByTaskId(evt.taskId);
      ws.send(
        JSON.stringify({
          type: "task_runs",
          taskId: evt.taskId,
          runs: runs.map(toRunItem),
          timestamp: new Date().toISOString(),
        }),
      );
      break;
    }
    case "user_message": {
      const userMessage = message as UserMessageEvent;
      await handleUserMessage(userMessage, ctx);
      break;
    }
    default: {
      ws.send(
        JSON.stringify({
          type: "error",
          code: "UNKNOWN_TYPE",
          message: `Unknown type: ${message.type}`,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }
}

async function handleUserMessage(userMessage: UserMessageEvent, ctx: HandlerContext) {
  const { deviceId, sendMessage, conversations, connectionManager } = ctx;

  if (!deviceId) {
    // Client should register before sending messages.
    return;
  }

  let conversation = await conversations.findById(userMessage.conversationId);
  if (!conversation) {
    conversation = new Conversation({
      id: userMessage.conversationId,
      title: userMessage.content.slice(0, 50) || "New conversation",
      deviceId: ctx.deviceId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await conversations.save(conversation);
  }

  try {
    const agentMessage = await sendMessage.execute(
      { conversationId: userMessage.conversationId, content: userMessage.content },
      (delta, messageId) => {
        connectionManager.sendToDevice(deviceId, {
          type: "agent_text_delta",
          messageId,
          conversationId: userMessage.conversationId,
          delta,
          timestamp: new Date().toISOString(),
        });
      },
    );

    connectionManager.sendToDevice(deviceId, {
      type: "agent_message_complete",
      messageId: agentMessage.id,
      conversationId: userMessage.conversationId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    connectionManager.sendToDevice(deviceId, {
      type: "error",
      code: "AGENT_ERROR",
      message: err instanceof Error ? err.message : "Failed to generate response",
      timestamp: new Date().toISOString(),
    });
  }
}
