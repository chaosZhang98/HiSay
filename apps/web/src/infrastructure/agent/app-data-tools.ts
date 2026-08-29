import { Type } from "typebox";
import {
  defineTool,
  type ToolDefinition,
  type AgentToolResult,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { AppDataService, ToolResult } from "../../application/app-data.service";

/** 工具执行所需的上下文：deviceId 由后端注入，Agent 无法伪造。 */
export interface AppDataToolContext {
  deviceId: string;
}

const FIELD_TYPE = Type.Union([
  Type.Literal("text"),
  Type.Literal("integer"),
  Type.Literal("real"),
  Type.Literal("boolean"),
  Type.Literal("date"),
]);

const FIELD_SCHEMA = Type.Object({
  name: Type.String({ description: "字段名（仅字母、数字、下划线）" }),
  type: FIELD_TYPE,
  required: Type.Optional(Type.Boolean({ description: "是否必填" })),
});

const PROJECT_ID = Type.String({ description: "项目 ID（由 list_projects 返回）" });
const TABLE_NAME = Type.String({ description: "表名（仅字母、数字、下划线）" });
const ROW_ID = Type.String({ description: "记录 ID（由 query_rows 返回）" });

/**
 * 把 Application 层的数据空间服务适配为 Pi SDK 可注册的 customTools。
 *
 * 每个工具都携带后端注入的 deviceId 上下文，Agent 只表达业务意图，
 * 底层由 AppDataService -> IDynamicDataStore 安全翻译成参数化 SQL。
 */
export function createAppDataTools(
  service: AppDataService,
  ctx: AppDataToolContext,
): ToolDefinition[] {
  /** 统一执行包装：捕获领域异常并转为结构化结果返回给模型。 */
  const run =
    (fn: (params: any) => Promise<ToolResult>) =>
    async (
      _toolCallId: string,
      params: unknown,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      _extensionCtx: ExtensionContext,
    ): Promise<AgentToolResult<ToolResult>> => {
      try {
        const res = await fn(params);
        return {
          content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
          details: res,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const payload: ToolResult = { ok: false, message };
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          details: payload,
        };
      }
    };

  return [
    defineTool({
      name: "create_project",
      label: "创建项目",
      description:
        "创建一个数据应用项目（如：减肥记录、记账、习惯打卡）。项目内可继续创建多张表。",
      parameters: Type.Object({
        name: Type.String({ description: "项目名称" }),
        description: Type.Optional(Type.String({ description: "项目用途描述" })),
      }),
      execute: run((p: any) =>
        service.createProject(ctx.deviceId, p.name, p.description),
      ),
    }),

    defineTool({
      name: "list_projects",
      label: "列出项目",
      description: "列出当前用户创建的所有数据项目。",
      parameters: Type.Object({}),
      execute: run(() => service.listProjects(ctx.deviceId)),
    }),

    defineTool({
      name: "rename_project",
      label: "重命名项目",
      description: "重命名一个已存在的项目。",
      parameters: Type.Object({
        projectId: PROJECT_ID,
        name: Type.String({ description: "新的项目名称" }),
      }),
      execute: run((p: any) =>
        service.renameProject(ctx.deviceId, p.projectId, p.name),
      ),
    }),

    defineTool({
      name: "delete_project",
      label: "删除项目",
      description: "删除一个项目及其全部表和数据。此操作不可恢复。",
      parameters: Type.Object({
        projectId: PROJECT_ID,
      }),
      execute: run((p: any) => service.deleteProject(ctx.deviceId, p.projectId)),
    }),

    defineTool({
      name: "create_table",
      label: "创建表",
      description:
        "在指定项目内创建一张数据表。fields 描述字段结构，支持 text/integer/real/boolean/date 五种类型。",
      parameters: Type.Object({
        projectId: PROJECT_ID,
        tableName: TABLE_NAME,
        fields: Type.Array(FIELD_SCHEMA, {
          description: "字段定义列表",
        }),
      }),
      execute: run((p: any) =>
        service.createTable(ctx.deviceId, p.projectId, p.tableName, p.fields),
      ),
    }),

    defineTool({
      name: "list_tables",
      label: "列出表",
      description: "列出指定项目下的所有数据表及其字段结构。",
      parameters: Type.Object({
        projectId: PROJECT_ID,
      }),
      execute: run((p: any) => service.listTables(ctx.deviceId, p.projectId)),
    }),

    defineTool({
      name: "delete_table",
      label: "删除表",
      description: "删除项目内的一张表及其全部数据。此操作不可恢复。",
      parameters: Type.Object({
        projectId: PROJECT_ID,
        tableName: TABLE_NAME,
      }),
      execute: run((p: any) =>
        service.deleteTable(ctx.deviceId, p.projectId, p.tableName),
      ),
    }),

    defineTool({
      name: "insert_row",
      label: "插入记录",
      description:
        "向指定表插入一条记录。data 的键必须与表字段名一致，未提供的必填字段会报错。",
      parameters: Type.Object({
        projectId: PROJECT_ID,
        tableName: TABLE_NAME,
        data: Type.Record(Type.String(), Type.Unknown(), {
          description: "字段名 -> 字段值的映射",
        }),
      }),
      execute: run((p: any) =>
        service.insertRow(ctx.deviceId, p.projectId, p.tableName, p.data),
      ),
    }),

    defineTool({
      name: "query_rows",
      label: "查询记录",
      description:
        "查询指定表的数据行。可按字段排序，limit 最多 1000 条，默认返回最近插入的 100 条。",
      parameters: Type.Object({
        projectId: PROJECT_ID,
        tableName: TABLE_NAME,
        limit: Type.Optional(Type.Integer({ description: "返回条数上限（1-1000）" })),
        orderBy: Type.Optional(
          Type.String({ description: "排序字段名，默认 created_at" }),
        ),
        orderDir: Type.Optional(
          Type.Union([Type.Literal("asc"), Type.Literal("desc")]),
        ),
      }),
      execute: run((p: any) =>
        service.queryRows(ctx.deviceId, p.projectId, p.tableName, {
          limit: p.limit,
          orderBy: p.orderBy,
          orderDir: p.orderDir,
        }),
      ),
    }),

    defineTool({
      name: "update_row",
      label: "更新记录",
      description: "按记录 ID 更新指定表中一条记录的部分字段。",
      parameters: Type.Object({
        projectId: PROJECT_ID,
        tableName: TABLE_NAME,
        rowId: ROW_ID,
        data: Type.Record(Type.String(), Type.Unknown(), {
          description: "需要更新的字段名 -> 新值",
        }),
      }),
      execute: run((p: any) =>
        service.updateRow(ctx.deviceId, p.projectId, p.tableName, p.rowId, p.data),
      ),
    }),

    defineTool({
      name: "delete_row",
      label: "删除记录",
      description: "按记录 ID 从指定表中删除一条记录。此操作不可恢复。",
      parameters: Type.Object({
        projectId: PROJECT_ID,
        tableName: TABLE_NAME,
        rowId: ROW_ID,
      }),
      execute: run((p: any) =>
        service.deleteRow(ctx.deviceId, p.projectId, p.tableName, p.rowId),
      ),
    }),
  ];
}
