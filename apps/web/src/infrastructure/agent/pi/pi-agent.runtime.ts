import {
  AuthStorage,
  createAgentSession,
  SessionManager,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { Model } from "@earendil-works/pi-ai";
import type { Message } from "../../../domain/message";
import type {
  AgentRuntimeInput,
  IAgentRuntime,
} from "../../../domain/agent-runtime";
import type { AgentRuntimeEvent } from "../../../domain/agent-events";
import type { AppDataService } from "../../../application/app-data.service";
import type { TaskToolService } from "../../../application/task-tool.service";
import { createAppDataTools } from "../app-data-tools";
import { createTaskTools } from "../task-tools";
import { piConfig } from "../pi.config";
import {
  A2UI_V09_BASIC_CATALOG_ID,
  createDemoSurfaceDocument,
} from "../../a2ui/a2ui-v09.mapper";

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

function buildPrompt(history: Message[]): string {
  if (history.length === 0) return "";
  return history
    .map((message) => {
      const label = message.role === "user" ? "User" : "Assistant";
      return `[${label}]: ${message.content}`;
    })
    .join("\n\n");
}

export class PiAgentRuntime implements IAgentRuntime {
  constructor(
    private readonly appDataService?: AppDataService,
    private readonly taskTools?: TaskToolService,
  ) {}

  async run(
    input: AgentRuntimeInput,
    emit: (event: AgentRuntimeEvent) => void,
  ): Promise<void> {
    const tools: ToolDefinition[] = [];
    if (input.ctx) {
      if (this.appDataService) {
        tools.push(
          ...createAppDataTools(this.appDataService, {
            deviceId: input.ctx.deviceId,
          }),
        );
      }
      if (this.taskTools) {
        tools.push(
          ...createTaskTools(this.taskTools, {
            deviceId: input.ctx.deviceId,
            conversationId: input.ctx.conversationId,
          }),
        );
      }
    }

    const { session } = await createSession({
      customTools: tools.length > 0 ? tools : undefined,
    });

    const unsubscribe = session.subscribe((event) => {
      if (event.type !== "message_update") return;
      const { assistantMessageEvent } = event;
      if (assistantMessageEvent.type === "text_delta") {
        emit({ kind: "text-delta", delta: assistantMessageEvent.delta });
      }
    });

    try {
      await session.prompt(buildPrompt(input.history));
      emit({
        kind: "surface",
        catalogId: A2UI_V09_BASIC_CATALOG_ID,
        document: createDemoSurfaceDocument(crypto.randomUUID()),
      });
    } catch (err) {
      emit({
        kind: "failed",
        message: err instanceof Error ? err.message : "Pi runtime failed",
      });
      throw err;
    } finally {
      unsubscribe();
    }
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
