import type { UUID } from "@hisay/shared";
import { NotFoundError } from "../domain/errors";
import { Message } from "../domain/message";
import { TaskRun } from "../domain/task-run";
import type { IAgentRuntime } from "../domain/agent-runtime";
import type {
  IConversationRepository,
  IMessageRepository,
  IScheduledTaskRepository,
  ITaskRunRepository,
} from "../domain/repositories";

export interface RunScheduledTaskResult {
  runId: UUID;
  taskId: UUID;
  status: "success" | "failed";
  output?: string;
  error?: string;
  /** 任务所属设备，用于定向推送结果消息。 */
  deviceId?: string | null;
  /** 创建该任务的会话（存在时执行结果会回写为一条 agent 消息）。 */
  conversationId?: string | null;
  /** 回写消息的 ID（已持久化到会话）。 */
  messageId?: UUID;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * 执行一个定时任务：调用 Agent 生成内容，持久化执行结果。
 * 定时任务没有多轮上下文，直接用任务 prompt 作为单一请求。
 * 若任务来源于某个会话（conversationId），执行结论会作为一条 agent 消息回写该会话，
 * 同时刷新会话更新时间，让用户打开对话即可看到执行结果。
 */
export class RunScheduledTaskUseCase {
  constructor(
    private readonly tasks: IScheduledTaskRepository,
    private readonly taskRuns: ITaskRunRepository,
    private readonly agent: IAgentRuntime,
    private readonly conversations: IConversationRepository,
    private readonly messages: IMessageRepository,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async execute(taskId: UUID): Promise<RunScheduledTaskResult> {
    const task = await this.tasks.findById(taskId);
    if (!task) {
      throw new NotFoundError("ScheduledTask");
    }

    const run = new TaskRun({
      id: crypto.randomUUID(),
      taskId,
      status: "running",
      output: null,
      error: null,
      runAt: new Date(),
      createdAt: new Date(),
    });
    await this.taskRuns.save(run);

    let result: RunScheduledTaskResult;

    try {
      // 定时任务生成内容：无上下文单轮生成，结果持久化不流式。
      // 加超时保护，避免模型请求挂起导致任务永远停留在 running。
      const output = await this.withTimeout(this.agent.generate(task.prompt));

      const completed = run.complete(output);
      await this.taskRuns.save(completed);
      result = {
        runId: completed.id,
        taskId,
        status: "success",
        output,
        deviceId: task.deviceId,
        conversationId: task.conversationId,
      };
    } catch (err) {
      const message =
        err instanceof Error && err.name === "TimeoutError"
          ? "Task execution timed out"
          : err instanceof Error
            ? err.message
            : "Task execution failed";
      const failed = run.fail(message);
      await this.taskRuns.save(failed);
      result = {
        runId: failed.id,
        taskId,
        status: "failed",
        error: message,
        deviceId: task.deviceId,
        conversationId: task.conversationId,
      };
    }

    // 结果回写来源会话
    if (task.conversationId) {
      result.messageId = await this.writeBack({
        prompt: task.prompt,
        conversationId: task.conversationId,
      }, result);
    }

    return result;
  }

  /** 把执行结论作为一条 agent 消息写入来源会话，并刷新会话更新时间。 */
  private async writeBack(
    task: { prompt: string; conversationId: string },
    result: RunScheduledTaskResult,
  ): Promise<string> {
    const content = buildResultMessage(task.prompt, result);
    const message = new Message({
      id: crypto.randomUUID(),
      conversationId: task.conversationId,
      role: "agent",
      content,
      createdAt: new Date(),
    });
    await this.messages.save(message);

    const conversation = await this.conversations.findById(task.conversationId);
    if (conversation) {
      await this.conversations.save(conversation.touch());
    }

    return message.id;
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const err = new Error("timeout");
        err.name = "TimeoutError";
        reject(err);
      }, this.timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }
}

/** 构造回写到会话的 Markdown 消息文本。 */
function buildResultMessage(
  taskPrompt: string,
  result: RunScheduledTaskResult,
): string {
  const statusText = result.status === "success" ? "成功" : "失败";
  const summary =
    result.status === "success"
      ? result.output ?? "（无输出）"
      : result.error ?? "（未知错误）";

  return [
    "**定时任务执行完成**",
    "",
    `- 任务：${taskPrompt}`,
    `- 时间：${new Date().toLocaleString("zh-CN")}`,
    `- 状态：${statusText}`,
    "",
    "```",
    summary,
    "```",
  ].join("\n");
}
