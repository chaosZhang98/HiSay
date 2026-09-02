import type { AgentRuntimeEvent } from "./agent-events";
import type { Message } from "./message";
import type { SurfaceAction } from "./surface";

/** 流式响应的可选上下文，用于注入 Agent 工具的权限上下文。 */
export interface AgentStreamContext {
  deviceId: string;
  conversationId: string;
}

export interface AgentRuntimeInput {
  runId: string;
  conversationId: string;
  history: Message[];
  action?: SurfaceAction;
  ctx?: AgentStreamContext;
}

/**
 * Host Agent 端口。Pi / Honey / DeepFlow 各自实现。
 * 输入输出都是领域对象，禁止出现官方 EventType。
 */
export interface IAgentRuntime {
  run(
    input: AgentRuntimeInput,
    emit: (event: AgentRuntimeEvent) => void,
  ): Promise<void>;
  generate(prompt: string): Promise<string>;
}
