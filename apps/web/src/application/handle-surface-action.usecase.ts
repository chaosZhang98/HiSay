import type { ConversationRunEvent } from "../domain/agent-events";
import { NotFoundError, ValidationError } from "../domain/errors";
import type { SurfaceAction } from "../domain/surface";
import type { IConversationRepository } from "../domain/repositories";
import type { RunConversationUseCase } from "./run-conversation.usecase";

export interface HandleSurfaceActionInput {
  conversationId: string;
  action: SurfaceAction;
  runId?: string;
}

export class HandleSurfaceActionUseCase {
  constructor(
    private readonly conversations: IConversationRepository,
    private readonly runConversation: RunConversationUseCase,
  ) {}

  async execute(
    input: HandleSurfaceActionInput,
    emit: (event: ConversationRunEvent) => void,
  ): Promise<void> {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation");
    }
    if (!input.action.name.trim() || !input.action.surfaceId.trim()) {
      throw new ValidationError("surfaceId and name are required");
    }

    await this.runConversation.execute(
      {
        conversationId: input.conversationId,
        runId: input.runId,
        action: input.action,
      },
      emit,
    );
  }
}
