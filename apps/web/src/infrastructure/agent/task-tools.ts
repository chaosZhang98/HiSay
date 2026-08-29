import { Type } from "typebox";
import {
  defineTool,
  type ToolDefinition,
  type AgentToolResult,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type {
  TaskToolService,
  TaskToolContext,
} from "../../application/task-tool.service";
import type { ToolResult } from "../../application/app-data.service";

const CRON_EXPRESSION = Type.String({
  description:
    '标准 cron 表达式（分 时 日 月 周）。示例：每天早上 9 点 = "0 9 * * *"，每 30 分钟 = "*/30 * * * *"',
});
const PROMPT = Type.String({
  description: "任务执行时要 Agent 生成的内容指令",
});

/**
 * 把 Application 层的任务工具服务适配为 Pi SDK 可注册的 customTools。
 *
 * deviceId 与 conversationId 由后端注入，Agent 只表达业务意图；
 * 创建的任务归属当前设备与来源会话，执行结果可回写该会话。
 */
export function createTaskTools(
  service: TaskToolService,
  ctx: TaskToolContext,
): ToolDefinition[] {
  /** 统一执行包装：捕获领域异常并转为结构化结果返回给模型。 */
  const run =
    (fn: (params: any) => Promise<ToolResult>) =>
    async (
      _toolCallId: string,
      params: unknown,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _extensionCtx: ExtensionContext,
    ): Promise<AgentToolResult<ToolResult>> => {
      try {
        const res = await fn(params);
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
          details: res,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const payload: ToolResult = { ok: false, message };
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          details: payload,
        };
      }
    };

  return [
    defineTool({
      name: "create_task",
      label: "创建定时任务",
      description:
        "创建一个定时任务：用户给出要做的事和时间意图时，翻译成 cron 表达式并创建。任务会在指定时间自动执行并把结果回写当前会话。",
      promptSnippet:
        "create_task：按用户的时间意图创建定时任务（cronExpression 为标准 cron 表达式，prompt 为执行时生成的内容指令）。",
      promptGuidelines: [
        "当用户表达“定时/每天/每周/每个工作日/提醒我 XX”等时间意图时，必须调用 create_task 工具真正创建任务，并在回复中给出任务详情；不要只口头确认而不调用工具。",
      ],
      parameters: Type.Object({
        cronExpression: CRON_EXPRESSION,
        prompt: PROMPT,
      }),
      execute: run((p: any) =>
        service.createTask(ctx, p.cronExpression, p.prompt),
      ),
    }),

    defineTool({
      name: "list_tasks",
      label: "列出定时任务",
      description: "列出当前用户已创建的全部定时任务，含启用状态与上次运行时间。",
      promptSnippet: "list_tasks：列出当前设备已创建的定时任务及其启用状态。",
      promptGuidelines: [
        "当用户询问“我的任务/有哪些定时任务/任务列表”时，调用 list_tasks 工具查询后回复，不要凭记忆编造。",
      ],
      parameters: Type.Object({}),
      execute: run(() => service.listTasks(ctx.deviceId)),
    }),
  ];
}
