import type { UUID } from "@hisay/shared";

export type AgentRunStatus = "started" | "streaming" | "finished" | "failed";

export interface AgentRunProps {
  id: UUID;
  conversationId: UUID;
  status: AgentRunStatus;
  createdAt: Date;
  finishedAt: Date | null;
  error: string | null;
}

/** 业务上的「跑一轮」，不是官方 RUN_STARTED 类型。 */
export class AgentRun {
  constructor(private readonly props: AgentRunProps) {}

  get id(): UUID {
    return this.props.id;
  }

  get conversationId(): UUID {
    return this.props.conversationId;
  }

  get status(): AgentRunStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get error(): string | null {
    return this.props.error;
  }

  toProps(): AgentRunProps {
    return { ...this.props };
  }

  startStreaming(): AgentRun {
    return new AgentRun({ ...this.props, status: "streaming" });
  }

  finish(now = new Date()): AgentRun {
    return new AgentRun({
      ...this.props,
      status: "finished",
      finishedAt: now,
    });
  }

  fail(message: string, now = new Date()): AgentRun {
    return new AgentRun({
      ...this.props,
      status: "failed",
      error: message,
      finishedAt: now,
    });
  }

  static start(conversationId: UUID, runId?: UUID): AgentRun {
    return new AgentRun({
      id: runId ?? crypto.randomUUID(),
      conversationId,
      status: "started",
      createdAt: new Date(),
      finishedAt: null,
      error: null,
    });
  }
}
