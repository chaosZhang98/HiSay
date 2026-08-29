-- 动态数据空间：记录 Agent 为用户创建的"应用项目"与表结构元数据
CREATE TABLE IF NOT EXISTS app_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_projects_device_id ON app_projects(device_id);

CREATE TABLE IF NOT EXISTS app_tables (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES app_projects(id) ON DELETE CASCADE,
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_app_tables_project_id ON app_tables(project_id);
