import type { UUID } from "@hisay/shared";
import type { AppProject } from "./app-project";
import type { AppTable, AppField } from "./app-table";

/**
 * 数据行。记录主键 id 与业务字段一起返回，供 Agent 与前端展示使用。
 */
export type AppRow = Record<string, unknown>;

export interface QueryRowsOptions {
  limit?: number;
  orderBy?: string;
  orderDir?: "asc" | "desc";
}

/**
 * 动态数据存储抽象。
 *
 * 用户通过 Agent 用自然语言创建"应用项目"，每个项目内可动态建表、写入/查询数据。
 * 工具层（Application/Infrastructure）负责把结构化意图翻译成安全的 SQL，
 * 并通过命名空间隔离保证 Agent 只能访问自己的项目数据。
 *
 * 未来切换底层数据库（如 Postgres/MySQL）时，仅需替换 Infrastructure 实现。
 */
export interface IDynamicDataStore {
  // ---- 项目（Project） ----
  createProject(input: {
    name: string;
    description?: string;
    deviceId: string;
  }): Promise<AppProject>;
  listProjects(deviceId: string): Promise<AppProject[]>;
  getProject(projectId: UUID): Promise<AppProject | null>;
  renameProject(projectId: UUID, name: string): Promise<AppProject>;
  deleteProject(projectId: UUID): Promise<void>;

  // ---- 表（Table） ----
  createTable(
    projectId: UUID,
    tableName: string,
    fields: AppField[],
  ): Promise<AppTable>;
  listTables(projectId: UUID): Promise<AppTable[]>;
  getTable(projectId: UUID, tableName: string): Promise<AppTable | null>;
  deleteTable(projectId: UUID, tableName: string): Promise<void>;

  // ---- 数据行（Row） ----
  insertRow(
    projectId: UUID,
    tableName: string,
    data: Record<string, unknown>,
  ): Promise<AppRow>;
  queryRows(
    projectId: UUID,
    tableName: string,
    options?: QueryRowsOptions,
  ): Promise<AppRow[]>;
  updateRow(
    projectId: UUID,
    tableName: string,
    rowId: string,
    data: Record<string, unknown>,
  ): Promise<AppRow | null>;
  deleteRow(projectId: UUID, tableName: string, rowId: string): Promise<boolean>;
}
