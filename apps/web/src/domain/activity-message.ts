import type { UUID } from "@hisay/shared";

export interface ActivityMessageProps {
  id: UUID;
  conversationId: UUID;
  activityType: string;
  content: Record<string, unknown>;
  createdAt: Date;
}

export class ActivityMessage {
  constructor(private readonly props: ActivityMessageProps) {}

  toProps(): ActivityMessageProps {
    return { ...this.props };
  }

  get id(): UUID {
    return this.props.id;
  }

  get conversationId(): UUID {
    return this.props.conversationId;
  }

  get activityType(): string {
    return this.props.activityType;
  }

  get content(): Record<string, unknown> {
    return this.props.content;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
