import {
  AuthStorage,
  createAgentSession,
  SessionManager,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { Model } from "@earendil-works/pi-ai";
import type { Message } from "../../domain/message";
import type { IAgentGateway, AgentStreamContext } from "../../domain/agent-gateway";
import type { AppDataService } from "../../application/app-data.service";
import type { TaskToolService } from "../../application/task-tool.service";
import { createAppDataTools } from "./app-data-tools";
import { createTaskTools } from "./task-tools";
import { piConfig } from "./pi.config";

function createMimoModel(): Model<"openai-completions"> {
  return {
    id: piConfig.model,
    name: "MiMo v2.5 Pro",
    api: "openai-completions",
    provider: "xiaomi",
    baseUrl: piConfig.baseUrl,
    reasoning: true,
    input: ["text"],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: 1_048_576,
    maxTokens: 16_384,
  };
}

async function createSession(options?: { customTools?: ToolDefinition[] }) {
  const model = createMimoModel();

  // Inject API key into an in-memory AuthStorage so the SDK can resolve it
  // for the "xiaomi" provider at request time.
  // Pi SDK also checks XIAOMI_API_KEY env var as a fallback.
  const authStorage = AuthStorage.inMemory();
  if (piConfig.apiKey) {
    authStorage.set("xiaomi", { type: "api_key", key: piConfig.apiKey });
  }

  return createAgentSession({
    sessionManager: SessionManager.inMemory(),
    model,
    authStorage,
    customTools: options?.customTools,
  });
}

/**
 * Build a structured prompt from domain conversation history.
 *
 * Pi SDK's `session.prompt()` handles context management internally.
 * We format messages with clear role labels so the model can follow the
 * conversation structure.
 */
function buildPrompt(history: Message[]): string {
  if (history.length === 0) return "";

  return history
    .map((m) => {
      const label = m.role === "user" ? "User" : "Assistant";
      return `[${label}]: ${m.content}`;
    })
    .join("\n\n");
}

export class PiAgentGateway implements IAgentGateway {
  constructor(
    private readonly appDataService?: AppDataService,
    private readonly taskTools?: TaskToolService,
  ) {}

  async streamResponse(
    history: Message[],
    onDelta: (delta: string) => void,
    ctx?: AgentStreamContext,
  ): Promise<string> {
    // 注入 Agent 工具：数据空间工具 + 定时任务工具（均携带后端注入的设备/会话上下文）
    const tools: ToolDefinition[] = [];
    if (ctx) {
      if (this.appDataService) {
        tools.push(
          ...createAppDataTools(this.appDataService, {
            deviceId: ctx.deviceId,
          }),
        );
      }
      if (this.taskTools) {
        tools.push(
          ...createTaskTools(this.taskTools, {
            deviceId: ctx.deviceId,
            conversationId: ctx.conversationId,
          }),
        );
      }
    }

    const { session } = await createSession({
      customTools: tools.length > 0 ? tools : undefined,
    });

    const prompt = buildPrompt(history);

    let fullText = "";
    const unsubscribe = session.subscribe((event) => {
      // AgentSessionEvent is a union: AgentEvent | session-specific events.
      // `assistantMessageEvent` only exists on message_update events, so we
      // must narrow the type before accessing it.
      if (event.type !== "message_update") return;

      const { assistantMessageEvent } = event;
      if (assistantMessageEvent.type === "text_delta") {
        const delta = assistantMessageEvent.delta;
        fullText += delta;
        onDelta(delta);
      }
    });

    await session.prompt(prompt);
    unsubscribe();
    return fullText;
  }

  async generate(prompt: string): Promise<string> {
    const { session } = await createSession();

    let fullText = "";
    const unsubscribe = session.subscribe((event) => {
      if (event.type !== "message_update") return;
      const { assistantMessageEvent } = event;
      if (assistantMessageEvent.type === "text_delta") {
        fullText += assistantMessageEvent.delta;
      }
    });

    await session.prompt(prompt);
    unsubscribe();
    return fullText;
  }
}
