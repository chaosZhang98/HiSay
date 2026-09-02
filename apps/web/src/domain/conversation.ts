import type { UUID } from "@hisay/shared";

export interface ConversationProps {
  id: UUID;
  title: string;
  deviceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Conversation {
  constructor(private readonly props: ConversationProps) {}

  get id(): UUID {
    return this.props.id;
  }

  get title(): string {
    return this.props.title;
  }

  get deviceId(): string | null {
    return this.props.deviceId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(title: string): Conversation {
    return new Conversation({ ...this.props, title, updatedAt: new Date() });
  }

  /** 会话有新动态（如任务结果回写）时刷新更新时间，让列表排序靠前。 */
  touch(now = new Date()): Conversation {
    return new Conversation({ ...this.props, updatedAt: now });
  }
}
