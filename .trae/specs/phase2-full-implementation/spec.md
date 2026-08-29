# Phase 2: 完整功能实现 Spec

## Why

Phase 1 搭建了项目骨架（monorepo、DDD 分层、实体/接口定义、空壳服务入口），但核心管道未接通——SQLite 没有具体 Repository 实现、WebSocket 收到消息后返回硬编码内容、Pi SDK 未实例化注入、移动端完全是空壳。需要完成从数据库到 LLM 到客户端的完整链路。

## What Changes

- 修复洋葱架构违规：将 `IAgentGateway` 接口从 infrastructure 移至 domain 层
- 实现三个 SQLite Repository（Conversation、Message、ScheduledTask）
- 实现 SQLite 归档 Repository（冷数据迁移）
- 补全 `MIMO_API_KEY` 配置并接入 Pi SDK
- 在服务入口完成依赖注入组装
- 将 WebSocket handler 连接到 `SendMessageUseCase`，实现真实消息流
- 增强 WebSocket 服务器：连接管理、Ping/Pong 心跳、设备认证
- 实现 Expo 移动端聊天 UI：消息列表、输入框、WebSocket 客户端、状态管理
- 添加 Next.js 健康检查端点

## Impact

- Affected code:
  - `apps/web/src/domain/` — 新增 `agent-gateway.ts` 接口文件
  - `apps/web/src/infrastructure/agent/agent-gateway.ts` — 删除（移至 domain）
  - `apps/web/src/infrastructure/db/` — 新增三个 Repository 实现 + 归档服务
  - `apps/web/src/infrastructure/agent/pi-agent.gateway.ts` — 修复事件处理
  - `apps/web/src/infrastructure/agent/pi.config.ts` — 补充 API key
  - `apps/web/src/infrastructure/websocket/server.ts` — 完整重写
  - `apps/web/src/infrastructure/cron/scheduler.ts` — 接入真实 Repository
  - `apps/web/src/server/index.ts` — 依赖注入组装
  - `apps/web/src/app/api/` — 新增健康检查端点
  - `apps/mobile/` — 新增聊天 UI、WebSocket 客户端、状态管理

## ADDED Requirements

### Requirement: SQLite Conversation Repository

系统 SHALL 提供 `SQLiteConversationRepository`，实现 `IConversationRepository` 接口，完成对话的 CRUD 操作。

#### Scenario: 创建对话
- **WHEN** 调用 `save()` 且对话不存在
- **THEN** 将对话插入 `conversations` 表

#### Scenario: 查找对话
- **WHEN** 调用 `findById(id)`
- **THEN** 返回 `Conversation` 实体或 `null`

### Requirement: SQLite Message Repository

系统 SHALL 提供 `SQLiteMessageRepository`，实现 `IMessageRepository` 接口，完成消息的读写和归档。

#### Scenario: 保存消息
- **WHEN** 调用 `save()` 且消息不存在
- **THEN** 将消息插入 `messages` 表

#### Scenario: 查找对话历史
- **WHEN** 调用 `findByConversationId(id)`
- **THEN** 按时间升序返回该对话所有消息

#### Scenario: 归档旧消息
- **WHEN** 调用 `archiveBefore(date)`
- **THEN** 将该日期之前的消息内容压缩后移入 `archives` 表，标记 `is_archived = 1`

### Requirement: SQLite Scheduled Task Repository

系统 SHALL 提供 `SQLiteScheduledTaskRepository`，实现 `IScheduledTaskRepository` 接口。

#### Scenario: 查得到期任务
- **WHEN** 调用 `findDue(before)`
- **THEN** 返回所有启用且上次运行时间早于 `before` 的任务

### Requirement: Pi SDK Agent Gateway

系统 SHALL 正确配置 Pi SDK，使用 MiMo v2.5 Pro 模型，通过 `MIMO_API_KEY` 环境变量认证。

#### Scenario: 流式响应
- **WHEN** `PiAgentGateway.streamResponse()` 被调用
- **THEN** 使用 Pi SDK 创建会话，将历史消息转换为 LLM 上下文，流式回调 delta 文本

### Requirement: WebSocket 消息流

系统 SHALL 将 WebSocket `user_message` 事件路由到 `SendMessageUseCase`，将 LLM 流式响应通过 `agent_text_delta` 事件推送回客户端。

#### Scenario: 用户发送消息，收到 AI 流式回复
- **WHEN** 客户端发送 `{ type: "user_message", conversationId, content }`
- **THEN** 服务端创建用户消息、调用 LLM、逐 delta 推送 `agent_text_delta`，最后发送 `agent_message_complete`

### Requirement: WebSocket 连接管理

系统 SHALL 维护一个 `Map<deviceId, WebSocket>` 连接池，支持设备认证和 Ping/Pong 心跳。

#### Scenario: 设备连接
- **WHEN** 新 WebSocket 连接建立
- **THEN** 通过连接消息中的 `deviceId` 注册连接

#### Scenario: 心跳检测
- **WHEN** 连接建立后
- **THEN** 每 30 秒发送 ping，连续 2 次未收到 pong 则断开连接

### Requirement: 依赖注入组装

系统 SHALL 在 `server/index.ts` 中实例化所有 Repository、Gateway、UseCase，并注入到 WebSocket handler。

#### Scenario: 服务启动
- **WHEN** 服务启动
- **THEN** 数据库 -> Repository -> Gateway -> UseCase -> WebSocket Server 按依赖顺序创建

### Requirement: Expo 聊天 UI

系统 SHALL 提供一个聊天界面，包含消息列表和文本输入框，通过 WebSocket 与后端通信。

#### Scenario: 发送消息
- **WHEN** 用户在输入框输入文本并点击发送
- **THEN** 通过 WebSocket 发送 `user_message` 事件，输入框清空

#### Scenario: 接收流式回复
- **WHEN** 收到 `agent_text_delta` 事件
- **THEN** 在消息列表底部实时更新 AI 回复内容

#### Scenario: 连接状态
- **WHEN** WebSocket 连接状态变化
- **THEN** 在界面顶部显示连接状态指示器

### Requirement: WebSocket 客户端单例

系统 SHALL 提供 WebSocket 连接单例，支持断线重连（指数退避，最大 30 秒）。

#### Scenario: 断线重连
- **WHEN** WebSocket 连接断开
- **THEN** 按指数退避策略自动重连，重连成功后恢复消息流

## MODIFIED Requirements

### Requirement: SendMessageUseCase 依赖方向

**修改前**：`IAgentGateway` 接口定义在 `infrastructure/agent/agent-gateway.ts`，应用层反向依赖基础设施层。

**修改后**：`IAgentGateway` 接口移至 `domain/agent-gateway.ts`，应用层仅依赖 domain 层接口。

## REMOVED Requirements

### Requirement: Next.js 作为独立 Dashboard

**Reason**: 当前阶段专注于 WebSocket 实时服务，Next.js dashboard 的 read-only UI 功能优先级低，暂不实现具体页面。

**Migration**: 保留 Next.js 项目结构，仅添加 `/api/health` 健康检查端点。
