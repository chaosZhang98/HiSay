import type { UUID } from "@hisay/shared";

export interface ScheduledTaskProps {
  id: UUID;
  cronExpression: string;
  prompt: string;
  isEnabled: boolean;
  /** 任务所属设备（用户隔离）。Agent 或手动创建时注入。 */
  deviceId: string | null;
  /** 创建该任务的会话，用于执行结果回写对话流。 */
  conversationId: string | null;
  lastRunAt?: Date;
  createdAt: Date;
}

export class ScheduledTask {
  constructor(private readonly props: ScheduledTaskProps) {}

  get id(): UUID {
    return this.props.id;
  }

  get cronExpression(): string {
    return this.props.cronExpression;
  }

  get prompt(): string {
    return this.props.prompt;
  }

  get isEnabled(): boolean {
    return this.props.isEnabled;
  }

  get deviceId(): string | null {
    return this.props.deviceId;
  }

  get conversationId(): string | null {
    return this.props.conversationId;
  }

  toProps(): ScheduledTaskProps {
    return { ...this.props };
  }

  markRun(now = new Date()): ScheduledTask {
    return new ScheduledTask({ ...this.props, lastRunAt: now });
  }
}
