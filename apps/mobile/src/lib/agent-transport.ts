import { HttpAgent } from "@ag-ui/client";
import { EventType, type BaseEvent } from "@ag-ui/core";
import { resolveAgentUrl } from "./api-url";
import { DEVICE_ID } from "./rest-api";
import { createUuid } from "./uuid";

export interface SurfaceActionInput {
  surfaceId: string;
  name: string;
  sourceComponentId?: string;
  context?: Record<string, unknown>;
}

export interface AgentClientEvent {
  kind:
    | "text-started"
    | "text-delta"
    | "text-completed"
    | "surface"
    | "run-finished"
    | "run-failed";
  messageId?: string;
  delta?: string;
  activityId?: string;
  activityType?: string;
  content?: Record<string, unknown>;
  message?: string;
}

export interface AgentMessageInput {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface IAgentTransport {
  run(input: {
    threadId: string;
    messages: AgentMessageInput[];
    action?: SurfaceActionInput;
    onEvent: (event: AgentClientEvent) => void;
  }): Promise<void>;
}

export interface ISurfaceActionPort {
  submit(input: {
    threadId: string;
    messages: AgentMessageInput[];
    action: SurfaceActionInput;
    onEvent: (event: AgentClientEvent) => void;
  }): Promise<void>;
}

function toClientEvent(event: BaseEvent): AgentClientEvent | null {
  const payload = event as unknown as {
    messageId?: string;
    delta?: string;
    activityType?: string;
    content?: Record<string, unknown>;
    message?: string;
  };
  switch (event.type) {
    case EventType.TEXT_MESSAGE_START:
      return { kind: "text-started", messageId: payload.messageId };
    case EventType.TEXT_MESSAGE_CONTENT:
      return {
        kind: "text-delta",
        messageId: payload.messageId,
        delta: payload.delta,
      };
    case EventType.TEXT_MESSAGE_END:
      return { kind: "text-completed", messageId: payload.messageId };
    case EventType.ACTIVITY_SNAPSHOT:
      return {
        kind: "surface",
        activityId: payload.messageId,
        activityType: payload.activityType,
        content: payload.content,
      };
    case EventType.RUN_FINISHED:
      return { kind: "run-finished" };
    case EventType.RUN_ERROR:
      return { kind: "run-failed", message: payload.message };
    default:
      return null;
  }
}

export class AgUiHttpTransport implements IAgentTransport, ISurfaceActionPort {
  constructor(private readonly url = resolveAgentUrl()) {}

  async run(input: {
    threadId: string;
    messages: AgentMessageInput[];
    action?: SurfaceActionInput;
    onEvent: (event: AgentClientEvent) => void;
  }): Promise<void> {
    const agent = new HttpAgent({
      url: this.url,
      threadId: input.threadId,
      headers: { "X-Device-Id": DEVICE_ID },
      initialMessages: input.messages,
    });

    await agent.runAgent(
      {
        runId: createUuid(),
        forwardedProps: input.action
          ? {
              a2uiAction: {
                userAction: {
                  name: input.action.name,
                  surfaceId: input.action.surfaceId,
                  sourceComponentId: input.action.sourceComponentId,
                  context: input.action.context,
                },
              },
            }
          : undefined,
      },
      {
        onEvent: ({ event }) => {
          const mapped = toClientEvent(event);
          if (mapped) input.onEvent(mapped);
        },
      },
    );
  }

  submit(input: {
    threadId: string;
    messages: AgentMessageInput[];
    action: SurfaceActionInput;
    onEvent: (event: AgentClientEvent) => void;
  }): Promise<void> {
    return this.run(input);
  }
}

export const agentTransport = new AgUiHttpTransport();
