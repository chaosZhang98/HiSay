import type { UUID } from "@hisay/shared";
import type { ActivityMessage } from "./activity-message";
import type { Conversation } from "./conversation";
import type { Message } from "./message";
import type { ScheduledTask } from "./scheduled-task";
import type { TaskRun } from "./task-run";

export interface IConversationRepository {
  findById(id: UUID): Promise<Conversation | null>;
  findLatestByDeviceId(deviceId: string): Promise<Conversation | null>;
  findAllByDeviceId(deviceId: string): Promise<Conversation[]>;
  findAll(): Promise<Conversation[]>;
  save(conversation: Conversation): Promise<void>;
  delete(id: UUID): Promise<void>;
}

export interface IMessageRepository {
  findById(id: UUID): Promise<Message | null>;
  findByConversationId(conversationId: UUID): Promise<Message[]>;
  findLatestByConversationId(conversationId: UUID): Promise<Message | null>;
  findArchivedByConversationId(conversationId: UUID): Promise<Message[]>;
  save(message: Message): Promise<void>;
  deleteByConversationId(conversationId: UUID): Promise<void>;
  archiveBefore(date: Date): Promise<number>;
}

export interface IActivityMessageRepository {
  findByConversationId(conversationId: UUID): Promise<ActivityMessage[]>;
  save(activity: ActivityMessage): Promise<void>;
  deleteByConversationId(conversationId: UUID): Promise<void>;
}

export interface IScheduledTaskRepository {
  findById(id: UUID): Promise<ScheduledTask | null>;
  findByDeviceId(deviceId: string): Promise<ScheduledTask[]>;
  findDue(before: Date): Promise<ScheduledTask[]>;
  findEnabled(): Promise<ScheduledTask[]>;
  save(task: ScheduledTask): Promise<void>;
  delete(id: UUID): Promise<void>;
}

export interface ITaskRunRepository {
  save(run: TaskRun): Promise<void>;
  findLatestByTaskId(taskId: UUID): Promise<TaskRun | null>;
  findByTaskId(taskId: UUID): Promise<TaskRun[]>;
}
