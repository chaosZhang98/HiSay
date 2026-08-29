import type { UUID } from "@agent/shared";
import { NotFoundError } from "../domain/errors";
import { Message } from "../domain/message";
import type { IAgentGateway } from "../domain/agent-gateway";
import type { IConversationRepository, IMessageRepository } from "../domain/repositories";

export interface SendMessageInput {
  conversationId: UUID;
  content: string;
}

export class SendMessageUseCase {
  constructor(
    private readonly conversations: IConversationRepository,
    private readonly messages: IMessageRepository,
    private readonly agent: IAgentGateway,
  ) {}

  async execute(input: SendMessageInput, onDelta: (delta: string, messageId: string) => void): Promise<Message> {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation");
    }

    const userMessage = new Message({
      id: crypto.randomUUID(),
      conversationId: input.conversationId,
      role: "user",
      content: input.content,
      createdAt: new Date(),
    });

    await this.messages.save(userMessage);

    const agentMessage = new Message({
      id: crypto.randomUUID(),
      conversationId: input.conversationId,
      role: "agent",
      content: "",
      createdAt: new Date(),
    });

    await this.messages.save(agentMessage);

    const history = await this.messages.findByConversationId(input.conversationId);
    const agentCtx = conversation.deviceId
      ? {
          deviceId: conversation.deviceId,
          conversationId: input.conversationId,
        }
      : undefined;
    const updated = await this.agent.streamResponse(history, (delta) => {
      onDelta(delta, agentMessage.id);
    }, agentCtx);

    const finalMessage = new Message({
      ...agentMessage.toProps(),
      content: updated,
    });

    await this.messages.save(finalMessage);
    return finalMessage;
  }
}
