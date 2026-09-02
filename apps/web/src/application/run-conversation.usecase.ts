import { AgentRun } from "../domain/agent-run";
import type { ConversationRunEvent } from "../domain/agent-events";
import type { IAgentRuntime } from "../domain/agent-runtime";
import { ActivityMessage } from "../domain/activity-message";
import { Message } from "../domain/message";
import { SURFACE_ACTIVITY_TYPE, type SurfaceAction } from "../domain/surface";
import { NotFoundError, ValidationError } from "../domain/errors";
import type {
  IActivityMessageRepository,
  IConversationRepository,
  IMessageRepository,
} from "../domain/repositories";

export interface RunConversationInput {
  conversationId: string;
  content?: string;
  runId?: string;
  action?: SurfaceAction;
}

export class RunConversationUseCase {
  constructor(
    private readonly conversations: IConversationRepository,
    private readonly messages: IMessageRepository,
    private readonly activities: IActivityMessageRepository,
    private readonly agent: IAgentRuntime,
  ) {}

  async execute(
    input: RunConversationInput,
    emit: (event: ConversationRunEvent) => void,
  ): Promise<void> {
    const conversation = await this.conversations.findById(input.conversationId);
    if (!conversation) {
      throw new NotFoundError("Conversation");
    }
    if (!input.content?.trim() && !input.action) {
      throw new ValidationError("content or action is required");
    }

    const run = AgentRun.start(input.conversationId, input.runId);
    emit({
      kind: "run-started",
      runId: run.id,
      conversationId: conversation.id,
    });

    if (input.content?.trim()) {
      await this.messages.save(
        new Message({
          id: crypto.randomUUID(),
          conversationId: conversation.id,
          role: "user",
          content: input.content.trim(),
          createdAt: new Date(),
        }),
      );
    } else if (input.action) {
      const extra = input.action.context
        ? ` ${JSON.stringify(input.action.context)}`
        : "";
      await this.messages.save(
        new Message({
          id: crypto.randomUUID(),
          conversationId: conversation.id,
          role: "user",
          content: `画布操作：${input.action.name}（${input.action.surfaceId}）${extra}`,
          createdAt: new Date(),
        }),
      );
    }

    const agentMessage = new Message({
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      role: "agent",
      content: "",
      createdAt: new Date(),
    });
    await this.messages.save(agentMessage);
    emit({ kind: "text-started", messageId: agentMessage.id });

    const history = await this.messages.findByConversationId(conversation.id);
    const ctx = conversation.deviceId
      ? { deviceId: conversation.deviceId, conversationId: conversation.id }
      : undefined;

    let assembled = "";
    const pendingSurfaces: Array<{ catalogId: string; document: Record<string, unknown> }> = [];
    try {
      await this.agent.run(
        {
          runId: run.id,
          conversationId: conversation.id,
          history,
          action: input.action,
          ctx,
        },
        (event) => {
          if (event.kind === "text-delta") {
            assembled += event.delta;
            emit({
              kind: "text-delta",
              messageId: agentMessage.id,
              delta: event.delta,
            });
            return;
          }
          if (event.kind === "surface") {
            pendingSurfaces.push({
              catalogId: event.catalogId,
              document: event.document,
            });
            return;
          }
          if (event.kind === "failed") {
            emit({ kind: "run-failed", runId: run.id, message: event.message });
          }
        },
      );

      const finalMessage = new Message({
        ...agentMessage.toProps(),
        content: assembled,
      });
      await this.messages.save(finalMessage);
      emit({
        kind: "text-completed",
        messageId: agentMessage.id,
        content: assembled,
      });

      for (const surface of pendingSurfaces) {
        await this.publishSurface(
          conversation.id,
          surface.catalogId,
          surface.document,
          emit,
        );
      }
      await this.conversations.save(conversation.touch());
      emit({
        kind: "run-finished",
        runId: run.id,
        conversationId: conversation.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Agent run failed";
      emit({ kind: "run-failed", runId: run.id, message });
      throw err;
    }
  }

  private async publishSurface(
    conversationId: string,
    catalogId: string,
    document: Record<string, unknown>,
    emit: (event: ConversationRunEvent) => void,
  ): Promise<void> {
    const activity = new ActivityMessage({
      id: crypto.randomUUID(),
      conversationId,
      activityType: SURFACE_ACTIVITY_TYPE,
      content: { catalogId, ...document },
      createdAt: new Date(),
    });
    await this.activities.save(activity);
    emit({
      kind: "surface-published",
      activityId: activity.id,
      catalogId,
      document: activity.content,
    });
  }
}
