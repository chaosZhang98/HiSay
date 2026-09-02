import type { UUID } from "@hisay/shared";

/** 允许 Agent 创建的数据字段类型白名单。 */
export type AppFieldType = "text" | "integer" | "real" | "boolean" | "date";

export interface AppField {
  name: string;
  type: AppFieldType;
  required?: boolean;
}

export interface AppTableProps {
  id: UUID;
  projectId: UUID;
  name: string;
  fields: AppField[];
  createdAt: Date;
  updatedAt: Date;
}

export class AppTable {
  constructor(private readonly props: AppTableProps) {}

  get id(): UUID {
    return this.props.id;
  }

  get projectId(): UUID {
    return this.props.projectId;
  }

  get name(): string {
    return this.props.name;
  }

  get fields(): AppField[] {
    return this.props.fields;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toProps(): AppTableProps {
    return { ...this.props };
  }
}
