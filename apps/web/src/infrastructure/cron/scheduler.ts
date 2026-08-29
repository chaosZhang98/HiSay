import cron from "node-cron";
import type { IScheduledTaskRepository } from "../../domain/repositories";
import type { RunScheduledTaskUseCase, RunScheduledTaskResult } from "../../application/run-scheduled-task.usecase";

export class CronScheduler {
  private task?: cron.ScheduledTask;
  private running = false;

  constructor(
    private readonly repository: IScheduledTaskRepository,
    private readonly runner: RunScheduledTaskUseCase,
    private readonly onResult?: (result: RunScheduledTaskResult) => void,
  ) {}

  start(schedule: string) {
    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron expression: ${schedule}`);
    }

    this.task = cron.schedule(
      schedule,
      async () => {
        // 防重入：上一轮还在执行时跳过本轮，避免任务堆积
        if (this.running) return;
        this.running = true;

        try {
          const now = new Date();
          const dueTasks = await this.repository.findDue(now);
          for (const task of dueTasks) {
            if (!task.isEnabled) continue;

            try {
              const result = await this.runner.execute(task.id);
              this.onResult?.(result);
            } catch (err) {
              console.error(`[cron] task ${task.id} failed`, err);
            }

            // 无论成败都标记本次已运行，避免下次 cron 重复触发
            await this.repository.save(task.markRun());
          }
        } finally {
          this.running = false;
        }
      },
    );
  }

  stop() {
    this.task?.stop();
  }
}
