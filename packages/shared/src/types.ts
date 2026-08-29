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
