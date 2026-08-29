# Rules 目录

这是项目的**单一规则源**（隐藏文件夹）。所有 AI 工具（TRAE、Cursor）的规则都从这里同步。

## 文件说明

| 文件 | 用途 |
|------|------|
| `project-rules.md` | 项目全局约束（TypeScript、pnpm、导入规则等） |
| `backend.md` | 后端 DDD 洋葱架构、WebSocket、SQLite 策略 |
| `frontend.md` | 前端 Expo + React Native 规范 |

## 同步方式

### 方式一：符号链接（推荐）

已配置为 symlink，两个工具自动读取同一份文件：

```
.trae/rules  → .rules/
.cursor/rules → .rules/
```

直接编辑 `.rules/` 下的文件即可，无需手动同步。

### 方式二：复制同步

如果 symlink 不可用（如权限问题），使用脚本：

```bash
./sync-rules.sh
```

## 修改规则流程

1. 编辑 `.rules/` 目录下的 `.md` 文件
2. 如果使用 symlink，修改立即生效
3. 如果使用复制方式，运行 `./sync-rules.sh`

## 注意事项

- 本目录为隐藏文件夹（`.` 前缀），防止误删
- 不要直接修改 `.trae/rules/` 或 `.cursor/rules/` 下的文件（如果是 symlink）
- `AGENTS.md` 是两个工具的入口文件，内容与 `project-rules.md` 有重叠，保持一致
- 新增规则文件后，需要运行 `./sync-rules.sh`（如果使用复制方式）
