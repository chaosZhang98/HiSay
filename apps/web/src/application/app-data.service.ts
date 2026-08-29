import type { UUID } from "@agent/shared";
import type { IDynamicDataStore, QueryRowsOptions } from "../domain/dynamic-data-store";
import type { AppField } from "../domain/app-table";
import type { AppProject } from "../domain/app-project";
import { NotFoundError } from "../domain/errors";

/** 返回给 Agent 的统一结果结构，便于模型解析与前端展示。 */
export interface ToolResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

/**
 * 应用数据空间服务（Application 层）。
 *
 * 面向 Agent 暴露语义化工具方法，负责：
 * - 设备所有权校验：任何项目操作都必须验证 project.deviceId === deviceId
 * - 只依赖 domain 层 IDynamicDataStore 抽象，不感知底层数据库
 * - 将领域结果包装为 Agent 友好的 ToolResult
 */
export class AppDataService {
  constructor(private readonly store: IDynamicDataStore) {}

  private async requireProjectOwned(
    deviceId: string,
    projectId: UUID,
  ): Promise<AppProject> {
    const project = await this.store.getProject(projectId);
    if (!project || project.deviceId !== deviceId) {
      throw new NotFoundError("Project");
    }
    return project;
  }

  async createProject(
    deviceId: string,
    name: string,
    description?: string,
  ): Promise<ToolResult> {
    const project = await this.store.createProject({ name, description, deviceId });
    return {
      ok: true,
      message: `项目 "${project.name}" 创建成功`,
      data: project.toProps(),
    };
  }

  async listProjects(deviceId: string): Promise<ToolResult> {
    const projects = await this.store.listProjects(deviceId);
    return {
      ok: true,
      message: `共有 ${projects.length} 个项目`,
      data: projects.map((p) => p.toProps()),
    };
  }

  async renameProject(
    deviceId: string,
    projectId: UUID,
    name: string,
  ): Promise<ToolResult> {
    await this.requireProjectOwned(deviceId, projectId);
    const renamed = await this.store.renameProject(projectId, name);
    return {
      ok: true,
      message: `项目已重命名为 "${renamed.name}"`,
      data: renamed.toProps(),
    };
  }

  async deleteProject(deviceId: string, projectId: UUID): Promise<ToolResult> {
    await this.requireProjectOwned(deviceId, projectId);
    await this.store.deleteProject(projectId);
    return { ok: true, message: "项目已删除" };
  }

  async createTable(
    deviceId: string,
    projectId: UUID,
    tableName: string,
    fields: AppField[],
  ): Promise<ToolResult> {
    await this.requireProjectOwned(deviceId, projectId);
    const table = await this.store.createTable(projectId, tableName, fields);
    return {
      ok: true,
      message: `表 "${table.name}" 创建成功，共 ${fields.length} 个字段`,
      data: table.toProps(),
    };
  }

  async listTables(deviceId: string, projectId: UUID): Promise<ToolResult> {
    await this.requireProjectOwned(deviceId, projectId);
    const tables = await this.store.listTables(projectId);
    return {
      ok: true,
      message: `共 ${tables.length} 张表`,
      data: tables.map((t) => t.toProps()),
    };
  }

  async deleteTable(
    deviceId: string,
    projectId: UUID,
    tableName: string,
  ): Promise<ToolResult> {
    await this.requireProjectOwned(deviceId, projectId);
    await this.store.deleteTable(projectId, tableName);
    return { ok: true, message: `表 "${tableName}" 已删除` };
  }

  async insertRow(
    deviceId: string,
    projectId: UUID,
    tableName: string,
    data: Record<string, unknown>,
  ): Promise<ToolResult> {
    await this.requireProjectOwned(deviceId, projectId);
    const row = await this.store.insertRow(projectId, tableName, data);
    return {
      ok: true,
      message: `已向 "${tableName}" 插入一条记录`,
      data: row,
    };
  }

  async queryRows(
    deviceId: string,
    projectId: UUID,
    tableName: string,
    options?: QueryRowsOptions,
  ): Promise<ToolResult> {
    await this.requireProjectOwned(deviceId, projectId);
    const rows = await this.store.queryRows(projectId, tableName, options);
    return {
      ok: true,
      message: `查询 "${tableName}" 返回 ${rows.length} 条记录`,
      data: rows,
    };
  }

  async updateRow(
    deviceId: string,
    projectId: UUID,
    tableName: string,
    rowId: string,
    data: Record<string, unknown>,
  ): Promise<ToolResult> {
    await this.requireProjectOwned(deviceId, projectId);
    const row = await this.store.updateRow(projectId, tableName, rowId, data);
    if (!row) throw new NotFoundError("Row");
    return {
      ok: true,
      message: `已更新 "${tableName}" 中的一条记录`,
      data: row,
    };
  }

  async deleteRow(
    deviceId: string,
    projectId: UUID,
    tableName: string,
    rowId: string,
  ): Promise<ToolResult> {
    await this.requireProjectOwned(deviceId, projectId);
    const deleted = await this.store.deleteRow(projectId, tableName, rowId);
    if (!deleted) throw new NotFoundError("Row");
    return { ok: true, message: `已从 "${tableName}" 删除一条记录` };
  }
}
