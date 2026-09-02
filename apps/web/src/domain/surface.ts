import type { UUID } from "@hisay/shared";

/** 用户点了画布。领域命令，不是 forwardedProps.a2uiAction。 */
export interface SurfaceAction {
  surfaceId: string;
  name: string;
  sourceComponentId?: string;
  context?: Record<string, unknown>;
}

export interface SurfaceProps {
  id: UUID;
  conversationId: UUID;
  catalogId: string;
  /** 协议无关的画布文档。传输层再映射成当前线上格式。 */
  document: Record<string, unknown>;
  createdAt: Date;
}

/** 一块可交互画布。不出现官方 EventType / a2ui_operations 字段名。 */
export class Surface {
  constructor(private readonly props: SurfaceProps) {}

  get id(): UUID {
    return this.props.id;
  }

  get conversationId(): UUID {
    return this.props.conversationId;
  }

  get catalogId(): string {
    return this.props.catalogId;
  }

  get document(): Record<string, unknown> {
    return this.props.document;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  toProps(): SurfaceProps {
    return { ...this.props };
  }
}

export const SURFACE_ACTIVITY_TYPE = "surface";
