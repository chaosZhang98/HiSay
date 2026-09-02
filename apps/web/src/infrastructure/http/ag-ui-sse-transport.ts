import { EventType, type BaseEvent, type RunAgentInput } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import type { A2UIForwardedProps } from "@ag-ui/a2ui-middleware";
import type { ConversationRunEvent } from "../../domain/agent-events";
import type { SurfaceAction } from "../../domain/surface";
import {
  officialActivityType,
  toOfficialActivityContent,
} from "../a2ui/a2ui-v09.mapper";

export function createEventEncoder(accept: string | undefined): EventEncoder {
  return new EventEncoder({ accept });
}

export function encodeRunEvent(
  encoder: EventEncoder,
  event: ConversationRunEvent,
): string {
  return encoder.encode(toOfficialEvent(event));
}

export function toOfficialEvent(event: ConversationRunEvent): BaseEvent {
  switch (event.kind) {
    case "run-started":
      return {
        type: EventType.RUN_STARTED,
        threadId: event.conversationId,
        runId: event.runId,
      };
    case "text-started":
      return {
        type: EventType.TEXT_MESSAGE_START,
        messageId: event.messageId,
        role: "assistant",
      };
    case "text-delta":
      return {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId: event.messageId,
        delta: event.delta,
      };
    case "text-completed":
      return {
        type: EventType.TEXT_MESSAGE_END,
        messageId: event.messageId,
      };
    case "surface-published":
      return {
        type: EventType.ACTIVITY_SNAPSHOT,
        messageId: event.activityId,
        activityType: officialActivityType(),
        replace: true,
        content: toOfficialActivityContent(event.document),
      };
    case "run-finished":
      return {
        type: EventType.RUN_FINISHED,
        threadId: event.conversationId,
        runId: event.runId,
      };
    case "run-failed":
      return {
        type: EventType.RUN_ERROR,
        message: event.message,
      };
    default: {
      const exhausted: never = event;
      return {
        type: EventType.RUN_ERROR,
        message: `Unhandled domain event: ${JSON.stringify(exhausted)}`,
      };
    }
  }
}

export function extractSurfaceAction(input: RunAgentInput): SurfaceAction | undefined {
  const forwarded = input.forwardedProps as A2UIForwardedProps | undefined;
  const action = forwarded?.a2uiAction?.userAction;
  if (!action?.name || !action.surfaceId) return undefined;
  return {
    surfaceId: action.surfaceId,
    name: action.name,
    sourceComponentId: action.sourceComponentId,
    context: action.context,
  };
}

export function lastUserText(input: RunAgentInput): string | undefined {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message.role === "user" && typeof message.content === "string" && message.content.trim()) {
      return message.content;
    }
  }
  return undefined;
}
