import type { UUID } from "@agent/shared";

export interface AppProjectProps {
  id: UUID;
  name: string;
  description: string | null;
  deviceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AppProject {
  constructor(private readonly props: AppProjectProps) {}

  get id(): UUID {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get deviceId(): string {
    return this.props.deviceId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toProps(): AppProjectProps {
    return { ...this.props };
  }

  rename(name: string): AppProject {
    return new AppProject({ ...this.props, name, updatedAt: new Date() });
  }
}
