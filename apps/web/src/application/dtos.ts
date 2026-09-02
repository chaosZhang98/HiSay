/** REST / 时间线 DTO。不是官方 EventType。 */

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
  status: "running" | "success" | "failed";
  output?: string;
  error?: string;
  runAt: string;
}

export interface TaskRunResultDto {
  taskId: string;
  runId: string;
  status: "success" | "failed";
  output?: string;
  error?: string;
  conversationId?: string;
  runAt: string;
}
