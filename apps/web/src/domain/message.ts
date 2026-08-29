import type { UUID } from "@agent/shared";

export type MessageRole = "user" | "agent";

export interface MessageProps {
  id: UUID;
  conversationId: UUID;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export class Message {
  constructor(private readonly props: MessageProps) {}

  toProps(): MessageProps {
    return { ...this.props };
  }

  get id(): UUID {
    return this.props.id;
  }

  get conversationId(): UUID {
    return this.props.conversationId;
  }

  get role(): MessageRole {
    return this.props.role;
  }

  get content(): string {
    return this.props.content;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  appendContent(delta: string): Message {
    return new Message({ ...this.props, content: this.props.content + delta });
  }
}
