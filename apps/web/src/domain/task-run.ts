import type { UUID } from "@hisay/shared";

export type TaskRunStatus = "running" | "success" | "failed";

export interface TaskRunProps {
  id: UUID;
  taskId: UUID;
  status: TaskRunStatus;
  output: string | null;
  error: string | null;
  runAt: Date;
  createdAt: Date;
}

export class TaskRun {
  constructor(private readonly props: TaskRunProps) {}

  toProps(): TaskRunProps {
    return { ...this.props };
  }

  get id(): UUID {
    return this.props.id;
  }

  get taskId(): UUID {
    return this.props.taskId;
  }

  get status(): TaskRunStatus {
    return this.props.status;
  }

  get output(): string | null {
    return this.props.output;
  }

  get error(): string | null {
    return this.props.error;
  }

  get runAt(): Date {
    return this.props.runAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  complete(output: string): TaskRun {
    return new TaskRun({ ...this.props, status: "success", output });
  }

  fail(error: string): TaskRun {
    return new TaskRun({ ...this.props, status: "failed", error });
  }
}