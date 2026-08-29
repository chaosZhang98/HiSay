import type { Message } from "./message";

/** 流式响应的可选上下文，用于注入 Agent 工具的权限上下文。 */
export interface AgentStreamContext {
  /** 当前设备标识，用于限定 Agent 可操作的数据空间。 */
  deviceId: string;
  /** 当前会话标识，用于 Agent 创建的任务关联来源会话。 */
  conversationId: string;
}

export interface IAgentGateway {
  streamResponse(
    history: Message[],
    onDelta: (delta: string) => void,
    ctx?: AgentStreamContext,
  ): Promise<string>;
  /** 无上下文的单轮生成，用于定时任务等场景。 */
  generate(prompt: string): Promise<string>;
}
