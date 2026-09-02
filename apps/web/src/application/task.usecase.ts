import { NotFoundError, ValidationError } from "../domain/errors";
import { ScheduledTask } from "../domain/scheduled-task";
import type { IScheduledTaskRepository, ITaskRunRepository } from "../domain/repositories";
import type { ScheduledTaskItem, TaskRunItem, TaskRunResultDto } from "./dtos";

export class TaskUseCase {
  constructor(
    private readonly tasks: IScheduledTaskRepository,
    private readonly taskRuns: ITaskRunRepository,
  ) {}

  async list(deviceId: string): Promise<ScheduledTaskItem[]> {
    const tasks = await this.tasks.findByDeviceId(deviceId);
    return tasks.map(toTaskItem);
  }

  async create(
    deviceId: string,
    cronExpression: string,
    prompt: string,
    conversationId?: string | null,
  ): Promise<ScheduledTaskItem> {
    const cron = cronExpression.trim();
    const content = prompt.trim();
    if (!cron || !content) {
      throw new ValidationError("cronExpression and prompt are required");
    }
    const task = new ScheduledTask({
      id: crypto.randomUUID(),
      cronExpression: cron,
      prompt: content,
      isEnabled: true,
      deviceId,
      conversationId: conversationId ?? null,
      createdAt: new Date(),
    });
    await this.tasks.save(task);
    return toTaskItem(task);
  }

  async toggle(deviceId: string, taskId: string): Promise<ScheduledTaskItem> {
    const task = await this.requireOwned(deviceId, taskId);
    const toggled = new ScheduledTask({
      ...task.toProps(),
      isEnabled: !task.isEnabled,
    });
    await this.tasks.save(toggled);
    return toTaskItem(toggled);
  }

  async remove(deviceId: string, taskId: string): Promise<void> {
    await this.requireOwned(deviceId, taskId);
    await this.tasks.delete(taskId);
  }

  async runs(deviceId: string, taskId: string): Promise<TaskRunItem[]> {
    await this.requireOwned(deviceId, taskId);
    const runs = await this.taskRuns.findByTaskId(taskId);
    return runs.map((run) => {
      const props = run.toProps();
      return {
        id: props.id,
        taskId: props.taskId,
        status: props.status,
        output: props.output ?? undefined,
        error: props.error ?? undefined,
        runAt: props.runAt.toISOString(),
      };
    });
  }

  async alerts(deviceId: string, since?: Date): Promise<TaskRunResultDto[]> {
    const tasks = await this.tasks.findByDeviceId(deviceId);
    const results: TaskRunResultDto[] = [];
    for (const task of tasks) {
      const runs = await this.taskRuns.findByTaskId(task.id);
      for (const run of runs) {
        if (run.status === "running") continue;
        if (since && run.runAt <= since) continue;
        results.push({
          taskId: run.taskId,
          runId: run.id,
          status: run.status,
          output: run.output ?? undefined,
          error: run.error ?? undefined,
          conversationId: task.conversationId ?? undefined,
          runAt: run.runAt.toISOString(),
        });
      }
    }
    return results
      .sort((a, b) => b.runAt.localeCompare(a.runAt))
      .slice(0, 50);
  }

  private async requireOwned(deviceId: string, taskId: string): Promise<ScheduledTask> {
    const task = await this.tasks.findById(taskId);
    if (!task || task.deviceId !== deviceId) {
      throw new NotFoundError("ScheduledTask");
    }
    return task;
  }
}

export function toTaskItem(task: ScheduledTask): ScheduledTaskItem {
  const props = task.toProps();
  return {
    id: task.id,
    cronExpression: task.cronExpression,
    prompt: task.prompt,
    isEnabled: task.isEnabled,
    lastRunAt: props.lastRunAt?.toISOString(),
    createdAt: props.createdAt.toISOString(),
  };
}
