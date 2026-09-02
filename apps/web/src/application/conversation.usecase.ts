import { Conversation } from "../domain/conversation";
import { NotFoundError, ValidationError } from "../domain/errors";
import type {
  IActivityMessageRepository,
  IConversationRepository,
  IMessageRepository,
} from "../domain/repositories";
import type {
  ActivityMessageItem,
  ConversationItem,
  ConversationTimelineItem,
  HistoryMessageItem,
} from "./dtos";

export class ConversationUseCase {
  constructor(
    private readonly conversations: IConversationRepository,
    private readonly messages: IMessageRepository,
    private readonly activities: IActivityMessageRepository,
  ) {}

  async ensureSession(deviceId: string): Promise<{
    conversation: ConversationItem;
    messages: ConversationTimelineItem[];
  }> {
    let conversation = await this.conversations.findLatestByDeviceId(deviceId);
    if (!conversation) {
      conversation = await this.createRaw(deviceId, "新会话");
    }
    return {
      conversation: await this.toItem(conversation),
      messages: await this.timeline(conversation.id),
    };
  }

  async list(deviceId: string): Promise<ConversationItem[]> {
    const conversations = await this.conversations.findAllByDeviceId(deviceId);
    const items: ConversationItem[] = [];
    for (const conversation of conversations) {
      items.push(await this.toItem(conversation));
    }
    return items;
  }

  async create(deviceId: string, title?: string): Promise<ConversationItem> {
    const conversation = await this.createRaw(deviceId, title?.trim() || "新会话");
    return this.toItem(conversation);
  }

  async rename(deviceId: string, conversationId: string, title: string): Promise<ConversationItem> {
    const conversation = await this.requireOwned(deviceId, conversationId);
    const next = title.trim() || "新会话";
    const updated = conversation.rename(next);
    await this.conversations.save(updated);
    return this.toItem(updated);
  }

  async remove(deviceId: string, conversationId: string): Promise<void> {
    await this.requireOwned(deviceId, conversationId);
    await this.messages.deleteByConversationId(conversationId);
    await this.activities.deleteByConversationId(conversationId);
    await this.conversations.delete(conversationId);
  }

  async history(deviceId: string, conversationId: string): Promise<ConversationTimelineItem[]> {
    await this.requireOwned(deviceId, conversationId);
    return this.timeline(conversationId);
  }

  async archivedForDevice(deviceId: string, conversationId: string): Promise<HistoryMessageItem[]> {
    await this.requireOwned(deviceId, conversationId);
    return this.archived(conversationId);
  }

  async timeline(conversationId: string): Promise<ConversationTimelineItem[]> {
    const texts = await this.messages.findByConversationId(conversationId);
    const acts = await this.activities.findByConversationId(conversationId);
    const history: HistoryMessageItem[] = texts.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    }));
    const activities: ActivityMessageItem[] = acts.map((activity) => ({
      id: activity.id,
      role: "activity",
      activityType: activity.activityType,
      content: activity.content,
      createdAt: activity.createdAt.toISOString(),
    }));
    return [...history, ...activities].sort((a, b) => {
      const byTime = a.createdAt.localeCompare(b.createdAt);
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });
  }

  async archived(conversationId: string): Promise<HistoryMessageItem[]> {
    const archived = await this.messages.findArchivedByConversationId(conversationId);
    return archived.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    }));
  }

  async ensureForThread(deviceId: string, conversationId: string, title?: string): Promise<void> {
    const existing = await this.conversations.findById(conversationId);
    if (existing) return;
    await this.conversations.save(
      new Conversation({
        id: conversationId,
        title: title?.trim() || "新会话",
        deviceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  private async createRaw(deviceId: string, title: string): Promise<Conversation> {
    if (!deviceId.trim()) {
      throw new ValidationError("deviceId is required");
    }
    const conversation = new Conversation({
      id: crypto.randomUUID(),
      title,
      deviceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await this.conversations.save(conversation);
    return conversation;
  }

  private async requireOwned(deviceId: string, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation || conversation.deviceId !== deviceId) {
      throw new NotFoundError("Conversation");
    }
    return conversation;
  }

  private async toItem(conversation: Conversation): Promise<ConversationItem> {
    const last = await this.messages.findLatestByConversationId(conversation.id);
    return {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
      preview: last ? last.content.slice(0, 50) : undefined,
    };
  }
}
