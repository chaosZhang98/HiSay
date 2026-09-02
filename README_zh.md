[English](./README.md) | 中文

# HiSay

个人 AI Agent 聊天助手，面向 iOS 平台。

## 技术栈

| 层级 | 技术 |
|------|------|
| 移动端 | Expo + React Native (iOS) |
| Web 仪表盘 | Next.js 15 |
| 实时服务 | Node.js HTTP + 官方 AG-UI SSE + `node-cron` |
| Agent 运行时 | Pi SDK (`@earendil-works/pi-coding-agent`) |
| LLM | MiMo v2.5 Pro (OpenAI 兼容) |
| 客户端-服务端协议 | 官方 AG-UI HTTP + SSE |
| 数据库 | SQLite (`better-sqlite3`)，支持冷热数据归档 |
| Monorepo | pnpm workspaces |

## 项目结构

```
HiSay/
├── .trae/rules/          # TRAE 项目规则
├── AGENTS.md               # AI Agent 入门文档
├── apps/
│   ├── mobile/             # Expo + React Native
│   └── web/                # Next.js 仪表盘 + 独立 Node 服务
├── packages/shared/        # 公共类型和 AG-UI 协议
└── package.json            # pnpm workspace 根目录
```

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9
- macOS + Xcode（用于 iOS 构建）

### 安装

```bash
pnpm install
```

> 注意：pnpm 在清理临时文件夹时可能会报告 TRAE 沙箱警告。安装本身会成功；您可以忽略该警告，或将 `/Users/apple/Library/pnpm/_tmp_*` 添加到沙箱白名单。

### 环境配置

复制 `.env.example` 并填写您的 MiMo API 密钥：

```bash
cp apps/web/.env.example apps/web/.env
```

```env
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_API_KEY=your-api-key-here
MIMO_MODEL=mimo-v2.5-pro
PORT=8080
DB_PATH=./data/agent.db
CRON_SCHEDULE=0 9 * * *
```

### 运行

```bash
# 首先构建共享包
pnpm --filter @hisay/shared build

# Web 仪表盘
pnpm --filter @hisay/web dev

# 独立 HTTP + AG-UI SSE Agent 服务
pnpm --filter @hisay/web dev:service

# iOS 移动应用
pnpm --filter @hisay/mobile ios
```

## 后端架构

后端遵循 DDD 洋葱架构：

```
  基础设施层
  (Pi SDK, SQLite, HTTP/SSE, cron)
       ↑
  应用层
  (用例)
       ↑
  领域层
  (实体, 仓储接口)
```

内层不依赖外层。Pi SDK 被封装在 `IAgentRuntime` 接口之后，以便日后可以替换 Agent 运行时，而无需修改领域逻辑。官方 AG-UI 包位于基础设施层。

## SQLite 数据归档策略

- 热数据：最近 90 天的消息内容保留在 `messages` 表中。
- 冷数据：超过 90 天的内容会压缩归档到 `archives` 表。
- 删除：压缩归档在 2 年后删除，仅保留摘要元数据。
- 维护：`VACUUM` 每 30 天通过 cron 执行一次。

对于个人使用 4-5 年，这将使数据库保持在 500 MB 以下。

## 注意事项

- AG-UI / A2UI 消息类型位于 `packages/shared/src/agui.ts`。请先更新此文件，然后同步两个客户端。
- Next.js 路由是只读的仪表盘/健康端点。所有变更和实时逻辑属于独立的 Node 服务。
- 不要提交 `.env` 或 `data/` 文件。
