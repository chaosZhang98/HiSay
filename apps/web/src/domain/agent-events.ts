import type { Surface } from "./surface";

/** Host Agent 运行时吐出的领域事件。不是官方 BaseEvent。 */
export type AgentRuntimeEvent =
  | { kind: "text-delta"; delta: string }
  | { kind: "surface"; catalogId: string; document: Record<string, unknown> }
  | { kind: "failed"; message: string };

/** 用例编排后交给传输层的会话回合事件。 */
export type ConversationRunEvent =
  | { kind: "run-started"; runId: string; conversationId: string }
  | { kind: "text-started"; messageId: string }
  | { kind: "text-delta"; messageId: string; delta: string }
  | { kind: "text-completed"; messageId: string; content: string }
  | { kind: "surface-published"; activityId: string; catalogId: string; document: Record<string, unknown> }
  | { kind: "run-finished"; runId: string; conversationId: string }
  | { kind: "run-failed"; runId: string; message: string };

export function isSurfaceEvent(
  event: AgentRuntimeEvent,
): event is Extract<AgentRuntimeEvent, { kind: "surface" }> {
  return event.kind === "surface";
}

export type { Surface };
