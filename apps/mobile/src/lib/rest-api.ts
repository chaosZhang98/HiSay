import type {
  ConversationItem,
  ConversationTimelineItem,
  HistoryMessageItem,
  ScheduledTaskItem,
  TaskRunItem,
  TaskRunResult,
} from "@hisay/shared";
import { resolveApiBaseUrl } from "./api-url";

export const DEVICE_ID = "ios-device-1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": DEVICE_ID,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export const restApi = {
  session() {
    return request<{
      conversation: ConversationItem;
      messages: ConversationTimelineItem[];
    }>("/session");
  },
  listConversations() {
    return request<{ conversations: ConversationItem[] }>("/conversations");
  },
  createConversation(title?: string) {
    return request<{ conversation: ConversationItem }>("/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  },
  conversationHistory(conversationId: string) {
    return request<{ conversationId: string; messages: ConversationTimelineItem[] }>(
      `/conversations/${conversationId}`,
    );
  },
  renameConversation(conversationId: string, title: string) {
    return request<{ conversation: ConversationItem }>(`/conversations/${conversationId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },
  deleteConversation(conversationId: string) {
    return request<{ ok: boolean }>(`/conversations/${conversationId}`, {
      method: "DELETE",
    });
  },
  archivedMessages(conversationId: string) {
    return request<{ conversationId: string; messages: HistoryMessageItem[] }>(
      `/conversations/${conversationId}/archived`,
    );
  },
  listTasks() {
    return request<{ tasks: ScheduledTaskItem[] }>("/tasks");
  },
  createTask(cronExpression: string, prompt: string, conversationId?: string) {
    return request<{ task: ScheduledTaskItem }>("/tasks", {
      method: "POST",
      body: JSON.stringify({ cronExpression, prompt, conversationId }),
    });
  },
  toggleTask(taskId: string) {
    return request<{ task: ScheduledTaskItem }>(`/tasks/${taskId}/toggle`, {
      method: "POST",
    });
  },
  deleteTask(taskId: string) {
    return request<{ ok: boolean }>(`/tasks/${taskId}`, { method: "DELETE" });
  },
  taskRuns(taskId: string) {
    return request<{ runs: TaskRunItem[] }>(`/tasks/${taskId}/runs`);
  },
  taskAlerts(since?: string) {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    return request<{ results: TaskRunResult[] }>(`/tasks/alerts${query}`);
  },
};
