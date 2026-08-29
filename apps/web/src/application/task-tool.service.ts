import type { IScheduledTaskRepository } from "../domain/repositories";
import { ScheduledTask } from "../domain/scheduled-task";
import type { ToolResult } from "./app-data.service";

/** Agent 创建/查询任务所需的上下文，由后端从会话注入，Agent 无法伪造。 */
export interface TaskToolContext {
  deviceId: string;
  conversationId: string;
}

/** 任务变更通知（由组合根注入，用于实时推送 task_changed 给客户端）。 */
export interface TaskToolServiceOptions {
  onTaskChanged?: (task: ScheduledTask) => void;
}

/**
 * 面向 Agent 暴露的任务工具服务（Application 层）。
 *
 * 让 Agent 通过 function call 创建/查询定时任务，而不是直接操作数据库。
 * 任务自动归属当前设备与来源会话，结果后续可回写该会话。
 */
export class TaskToolService {
  constructor(
    private readonly tasks: IScheduledTaskRepository,
    private readonly options: TaskToolServiceOptions = {},
  ) {}

  async createTask(
    ctx: TaskToolContext,
    cronExpression: string,
    prompt: string,
  ): Promise<ToolResult> {
    const cron = cronExpression.trim();
    const content = prompt.trim();
    if (!cron || !content) {
      return { ok: false, message: "cronExpression 和 prompt 不能为空" };
    }

    const task = new ScheduledTask({
      id: crypto.randomUUID(),
      cronExpression: cron,
      prompt: content,
      isEnabled: true,
      deviceId: ctx.deviceId,
      conversationId: ctx.conversationId,
      createdAt: new Date(),
    });
    await this.tasks.save(task);
    this.options.onTaskChanged?.(task);

    return {
      ok: true,
      message: `定时任务已创建（${cron}），将按计划自动执行`,
      data: {
        id: task.id,
        cronExpression: task.cronExpression,
        prompt: task.prompt,
        isEnabled: task.isEnabled,
      },
    };
  }

  async listTasks(deviceId: string): Promise<ToolResult> {
    const tasks = await this.tasks.findByDeviceId(deviceId);
    return {
      ok: true,
      message: `当前共有 ${tasks.length} 个定时任务`,
      data: tasks.map((t) => {
        const props = t.toProps();
        return {
          id: t.id,
          cronExpression: t.cronExpression,
          prompt: t.prompt,
          isEnabled: t.isEnabled,
          lastRunAt: props.lastRunAt?.toISOString() ?? null,
          createdAt: props.createdAt.toISOString(),
        };
      }),
    };
  }
}
