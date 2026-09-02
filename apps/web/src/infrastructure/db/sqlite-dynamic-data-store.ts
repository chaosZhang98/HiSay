import type Database from "better-sqlite3";
import type { UUID } from "@hisay/shared";
import { AppProject } from "../../domain/app-project";
import { AppTable } from "../../domain/app-table";
import type { AppField, AppFieldType } from "../../domain/app-table";
import type {
  AppRow,
  IDynamicDataStore,
  QueryRowsOptions,
} from "../../domain/dynamic-data-store";
import { ValidationError, NotFoundError } from "../../domain/errors";

/** 字段名/表名白名单：仅允许字母、数字、下划线。 */
const IDENT_RE = /^[a-zA-Z0-9_]+$/;
/** 每个项目物理表名的前缀（projectId 去掉连字符 + 下划线），实现命名空间隔离。 */
const PHYSICAL_PREFIX = "app_";

/** 每张数据表自动附加的隐藏列，不允许与业务字段冲突。 */
const RESERVED_COLUMNS = new Set(["id", "created_at", "updated_at"]);

const TYPE_TO_SQL: Record<AppFieldType, string> = {
  text: "TEXT",
  integer: "INTEGER",
  real: "REAL",
  boolean: "INTEGER",
  date: "TEXT",
};

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  device_id: string;
  created_at: string;
  updated_at: string;
}

interface TableRow {
  id: string;
  project_id: string;
  name: string;
  fields_json: string;
  created_at: string;
  updated_at: string;
}

function toProject(row: ProjectRow): AppProject {
  return new AppProject({
    id: row.id,
    name: row.name,
    description: row.description,
    deviceId: row.device_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function toTable(row: TableRow): AppTable {
  return new AppTable({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    fields: JSON.parse(row.fields_json) as AppField[],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

/** 按字段类型把外部值规范化为可安全写入 SQLite 的存储值。 */
function normalizeValue(field: AppField, value: unknown): unknown {
  if (value === null || value === undefined || value === "") {
    if (field.required) {
      throw new ValidationError(`Field "${field.name}" is required`);
    }
    return null;
  }
  switch (field.type) {
    case "text":
      return String(value);
    case "integer": {
      const n = Number(value);
      if (!Number.isInteger(n)) {
        throw new ValidationError(`Field "${field.name}" expects an integer`);
      }
      return n;
    }
    case "real": {
      const n = Number(value);
      if (Number.isNaN(n)) {
        throw new ValidationError(`Field "${field.name}" expects a number`);
      }
      return n;
    }
    case "boolean":
      return value === true || value === 1 || value === "true" || value === "1" ? 1 : 0;
    case "date": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) {
        throw new ValidationError(`Field "${field.name}" expects a date`);
      }
      return d.toISOString();
    }
  }
}

/** 把存储值转回对外展示的 JS 值（boolean 0/1 → true/false）。 */
function denormalizeValue(field: AppField, value: unknown): unknown {
  if (field.type === "boolean") return value === 1 || value === true;
  return value;
}

export class SQLiteDynamicDataStore implements IDynamicDataStore {
  constructor(private readonly db: Database.Database) {}

  // ---- 项目（Project） ----

  async createProject(input: {
    name: string;
    description?: string;
    deviceId: string;
  }): Promise<AppProject> {
    const name = input.name.trim();
    if (!name) throw new ValidationError("Project name is required");

    const project = new AppProject({
      id: crypto.randomUUID(),
      name,
      description: input.description?.trim() || null,
      deviceId: input.deviceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.db
      .prepare(
        `INSERT INTO app_projects (id, name, description, device_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        project.id,
        project.name,
        project.description,
        project.deviceId,
        project.createdAt.toISOString(),
        project.updatedAt.toISOString(),
      );

    return project;
  }

  async listProjects(deviceId: string): Promise<AppProject[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM app_projects WHERE device_id = ? ORDER BY updated_at DESC`,
      )
      .all(deviceId) as ProjectRow[];
    return rows.map(toProject);
  }

  async getProject(projectId: UUID): Promise<AppProject | null> {
    const row = this.db
      .prepare("SELECT * FROM app_projects WHERE id = ?")
      .get(projectId) as ProjectRow | undefined;
    return row ? toProject(row) : null;
  }

  async renameProject(projectId: UUID, name: string): Promise<AppProject> {
    const existing = await this.getProject(projectId);
    if (!existing) throw new NotFoundError("Project");
    if (!name.trim()) throw new ValidationError("Project name is required");

    const renamed = existing.rename(name.trim());
    this.db
      .prepare("UPDATE app_projects SET name = ?, updated_at = ? WHERE id = ?")
      .run(renamed.name, renamed.updatedAt.toISOString(), renamed.id);
    return renamed;
  }

  async deleteProject(projectId: UUID): Promise<void> {
    const tables = await this.listTables(projectId);
    const dropAll = this.db.transaction(() => {
      for (const table of tables) {
        this.db.exec(`DROP TABLE IF EXISTS ${this.physicalName(projectId, table.name)}`);
      }
      this.db.prepare("DELETE FROM app_projects WHERE id = ?").run(projectId);
    });
    dropAll();
  }

  // ---- 表（Table） ----

  async createTable(
    projectId: UUID,
    tableName: string,
    fields: AppField[],
  ): Promise<AppTable> {
    await this.assertProjectExists(projectId);
    const name = tableName.trim();
    if (!IDENT_RE.test(name)) {
      throw new ValidationError(
        'Table name may only contain letters, digits and underscores',
      );
    }

    const seen = new Set<string>();
    for (const field of fields) {
      const fname = field.name.trim();
      if (!IDENT_RE.test(fname)) {
        throw new ValidationError(
          `Field name "${field.name}" may only contain letters, digits and underscores`,
        );
      }
      if (RESERVED_COLUMNS.has(fname)) {
        throw new ValidationError(`Field name "${fname}" is reserved`);
      }
      if (!(field.type in TYPE_TO_SQL)) {
        throw new ValidationError(`Unknown field type "${field.type}"`);
      }
      if (seen.has(fname)) {
        throw new ValidationError(`Duplicate field name "${fname}"`);
      }
      seen.add(fname);
    }

    const columns = [
      "id TEXT PRIMARY KEY",
      ...fields.map(
        (f) => `${f.name} ${TYPE_TO_SQL[f.type]}${f.required ? " NOT NULL" : ""}`,
      ),
      "created_at TEXT NOT NULL",
      "updated_at TEXT NOT NULL",
    ];

    const physical = this.physicalName(projectId, name);
    this.db.exec(`CREATE TABLE ${physical} (${columns.join(", ")})`);

    const table = new AppTable({
      id: crypto.randomUUID(),
      projectId,
      name,
      fields: fields.map((f) => ({ ...f, name: f.name.trim() })),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.db
      .prepare(
        `INSERT INTO app_tables (id, project_id, name, fields_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        table.id,
        table.projectId,
        table.name,
        JSON.stringify(table.fields),
        table.createdAt.toISOString(),
        table.updatedAt.toISOString(),
      );

    return table;
  }

  async listTables(projectId: UUID): Promise<AppTable[]> {
    const rows = this.db
      .prepare("SELECT * FROM app_tables WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as TableRow[];
    return rows.map(toTable);
  }

  async getTable(projectId: UUID, tableName: string): Promise<AppTable | null> {
    const row = this.db
      .prepare("SELECT * FROM app_tables WHERE project_id = ? AND name = ?")
      .get(projectId, tableName.trim()) as TableRow | undefined;
    return row ? toTable(row) : null;
  }

  async deleteTable(projectId: UUID, tableName: string): Promise<void> {
    const table = await this.getTable(projectId, tableName);
    if (!table) throw new NotFoundError("Table");

    const drop = this.db.transaction(() => {
      this.db.exec(`DROP TABLE IF EXISTS ${this.physicalName(projectId, table.name)}`);
      this.db
        .prepare("DELETE FROM app_tables WHERE id = ?")
        .run(table.id);
    });
    drop();
  }

  // ---- 数据行（Row） ----

  async insertRow(
    projectId: UUID,
    tableName: string,
    data: Record<string, unknown>,
  ): Promise<AppRow> {
    const table = await this.requireTable(projectId, tableName);
    const fields = table.fields;

    const rowId = crypto.randomUUID();
    const now = new Date().toISOString();

    const columns = ["id"];
    const values: unknown[] = [rowId];

    for (const field of fields) {
      columns.push(field.name);
      values.push(normalizeValue(field, data[field.name]));
    }
    columns.push("created_at", "updated_at");
    values.push(now, now);

    const physical = this.physicalName(projectId, table.name);
    this.db
      .prepare(`INSERT INTO ${physical} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`)
      .run(...values);

    return this.fetchRow(projectId, table, rowId);
  }

  async queryRows(
    projectId: UUID,
    tableName: string,
    options: QueryRowsOptions = {},
  ): Promise<AppRow[]> {
    const table = await this.requireTable(projectId, tableName);
    const physical = this.physicalName(projectId, table.name);

    const orderBy = options.orderBy ?? "created_at";
    const allowedOrder = new Set(["id", "created_at", "updated_at", ...table.fields.map((f) => f.name)]);
    if (!allowedOrder.has(orderBy)) {
      throw new ValidationError(`Cannot order by "${orderBy}"`);
    }

    const orderDir = options.orderDir === "asc" ? "ASC" : "DESC";
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 1000) : 100;

    const rows = this.db
      .prepare(`SELECT * FROM ${physical} ORDER BY ${orderBy} ${orderDir} LIMIT ?`)
      .all(limit) as Record<string, unknown>[];

    return this.denormalizeRows(table, rows);
  }

  async updateRow(
    projectId: UUID,
    tableName: string,
    rowId: string,
    data: Record<string, unknown>,
  ): Promise<AppRow | null> {
    const table = await this.requireTable(projectId, tableName);
    const fields = table.fields;

    const sets: string[] = [];
    const values: unknown[] = [];

    for (const field of fields) {
      if (!(field.name in data)) continue;
      sets.push(`${field.name} = ?`);
      values.push(normalizeValue(field, data[field.name]));
    }
    if (sets.length === 0) {
      throw new ValidationError("No updatable fields provided");
    }

    sets.push("updated_at = ?");
    values.push(new Date().toISOString(), rowId);

    const physical = this.physicalName(projectId, table.name);
    const result = this.db
      .prepare(`UPDATE ${physical} SET ${sets.join(", ")} WHERE id = ?`)
      .run(...values);

    if (result.changes === 0) return null;
    return this.fetchRow(projectId, table, rowId);
  }

  async deleteRow(
    projectId: UUID,
    tableName: string,
    rowId: string,
  ): Promise<boolean> {
    const table = await this.requireTable(projectId, tableName);
    const physical = this.physicalName(projectId, table.name);
    const result = this.db
      .prepare(`DELETE FROM ${physical} WHERE id = ?`)
      .run(rowId);
    return result.changes > 0;
  }

  // ---- 内部工具 ----

  /** 物理表名：app_<projectId(去连字符)>_<tableName>。 */
  private physicalName(projectId: UUID, tableName: string): string {
    return `${PHYSICAL_PREFIX}${projectId.replace(/-/g, "")}_${tableName}`;
  }

  private async assertProjectExists(projectId: UUID): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) throw new NotFoundError("Project");
  }

  private async requireTable(projectId: UUID, tableName: string): Promise<AppTable> {
    const table = await this.getTable(projectId, tableName);
    if (!table) throw new NotFoundError("Table");
    return table;
  }

  private fetchRow(projectId: UUID, table: AppTable, rowId: string): AppRow {
    const physical = this.physicalName(projectId, table.name);
    const row = this.db
      .prepare(`SELECT * FROM ${physical} WHERE id = ?`)
      .get(rowId) as Record<string, unknown> | undefined;
    if (!row) throw new NotFoundError("Row");
    return this.denormalizeRows(table, [row])[0];
  }

  private denormalizeRows(table: AppTable, rows: Record<string, unknown>[]): AppRow[] {
    const typeMap = new Map(table.fields.map((f) => [f.name, f.type]));
    return rows.map((row) => {
      const out: AppRow = { ...row };
      for (const [key, value] of Object.entries(row)) {
        const type = typeMap.get(key);
        if (type === "boolean") {
          out[key] = value === 1 || value === true;
        }
      }
      return out;
    });
  }
}
