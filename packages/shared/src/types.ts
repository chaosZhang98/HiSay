export type UUID = string;

export interface Conversation {
  id: UUID;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: UUID;
  conversationId: UUID;
  role: "user" | "agent";
  content: string;
  createdAt: string;
}

export interface ScheduledTask {
  id: UUID;
  cronExpression: string;
  prompt: string;
  isEnabled: boolean;
  lastRunAt?: string;
  createdAt: string;
}

export interface HistoryMessageItem {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
}

export interface ActivityMessageItem {
  id: string;
  role: "activity";
  activityType: string;
  content: Record<string, unknown>;
  createdAt: string;
}

export type ConversationTimelineItem = HistoryMessageItem | ActivityMessageItem;

export function isActivityMessageItem(
  item: ConversationTimelineItem,
): item is ActivityMessageItem {
  return item.role === "activity";
}

export function isHistoryMessageItem(
  item: ConversationTimelineItem,
): item is HistoryMessageItem {
  return item.role === "user" || item.role === "agent";
}

export function mergeConversationTimeline(
  texts: HistoryMessageItem[],
  activities: ActivityMessageItem[],
): ConversationTimelineItem[] {
  return [...texts, ...activities].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
}

export interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
  preview?: string;
}

export interface ScheduledTaskItem {
  id: string;
  cronExpression: string;
  prompt: string;
  isEnabled: boolean;
  lastRunAt?: string;
  createdAt: string;
}

export interface TaskRunItem {
  id: string;
  taskId: string;
  status: "success" | "failed" | "running";
  output?: string;
  error?: string;
  runAt: string;
}

export interface TaskRunResult {
  taskId: string;
  runId: string;
  status: "success" | "failed";
  output?: string;
  error?: string;
  conversationId?: string;
  runAt?: string;
}
