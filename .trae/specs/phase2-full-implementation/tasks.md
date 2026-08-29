# Tasks

## Task 1: 修复架构违规 — 移动 IAgentGateway 到 domain 层

将 `IAgentGateway` 接口从 `infrastructure/agent/agent-gateway.ts` 移至 `domain/agent-gateway.ts`，更新所有导入路径。删除 infrastructure 层的旧文件。

- [x] SubTask 1.1: 创建 `domain/agent-gateway.ts`，定义接口
- [x] SubTask 1.2: 删除 `infrastructure/agent/agent-gateway.ts`
- [x] SubTask 1.3: 更新 `pi-agent.gateway.ts` 的 import 路径
- [x] SubTask 1.4: 更新 `send-message.usecase.ts` 的 import 路径
- [x] SubTask 1.5: 运行 `pnpm --filter @agent/web typecheck` 验证

## Task 2: 补全基础设施配置

修复 Pi SDK 配置和数据库初始化。

- [x] SubTask 2.1: 在 `pi.config.ts` 中添加 `MIMO_API_KEY` 环境变量读取（Phase 1 已完成）
- [x] SubTask 2.2: 在 `database.ts` 中添加 `PRAGMA foreign_keys = ON` 和迁移版本跟踪（Phase 1 已完成）
- [x] SubTask 2.3: 更新 `.env.example` 确保所有必要变量都有文档（Phase 1 已完成）

## Task 3: 实现 SQLite Conversation Repository

- [x] SubTask 3.1: 创建 `infrastructure/db/sqlite-conversation.repository.ts`
  - 实现 `findById(id)`: 从 `conversations` 表查询，映射行数据为 `Conversation` 实体
  - 实现 `findAll()`: 查询所有对话，按 `updated_at` 降序
  - 实现 `save(conversation)`: 使用 `INSERT OR REPLACE` 插入/更新
- [x] SubTask 3.2: 运行 typecheck 验证

## Task 4: 实现 SQLite Message Repository

- [x] SubTask 4.1: 创建 `infrastructure/db/sqlite-message.repository.ts`
  - 实现 `findByConversationId(id)`: 按 `created_at` 升序查询，跳过已归档消息
  - 实现 `save(message)`: `INSERT OR REPLACE`
  - 实现 `archiveBefore(date)`: 查询旧消息 -> 压缩 content -> 写入 `archives` 表 -> 标记 `is_archived = 1` -> 返回归档数量
- [x] SubTask 4.2: 运行 typecheck 验证

## Task 5: 实现 SQLite Scheduled Task Repository

- [x] SubTask 5.1: 创建 `infrastructure/db/sqlite-scheduled-task.repository.ts`
  - 实现 `findDue(before)`: 查询 `is_enabled = 1` 且 (`last_run_at IS NULL` 或 `last_run_at < before`) 的任务
  - 实现 `findEnabled()`: 查询所有启用任务
  - 实现 `save(task)`: `INSERT OR REPLACE`
- [x] SubTask 5.2: 运行 typecheck 验证

## Task 6: 实现归档 Cron 服务

- [x] SubTask 6.1: 创建 `infrastructure/cron/archive.service.ts`
  - 查询 `messages` 表中 90 天前且 `is_archived = 0` 的消息
  - 调用 `IMessageRepository.archiveBefore()` 执行归档
  - 每 30 天执行一次 VACUUM
- [x] SubTask 6.2: 运行 typecheck 验证

## Task 7: 重写 WebSocket 服务器

完全重写 WebSocket 服务器，接入真实 use case。

- [x] SubTask 7.1: 创建 `infrastructure/websocket/connection-manager.ts`
  - 维护 `Map<deviceId, WebSocket>` 连接池
  - 实现 `register(deviceId, ws)` / `unregister(deviceId)` / `sendToDevice(deviceId, message)`
  - 实现 Ping/Pong 心跳：30 秒间隔，2 次未 pong 断开
- [x] SubTask 7.2: 重写 `infrastructure/websocket/server.ts`
  - 接收 `SendMessageUseCase` 作为依赖
  - 连接建立后要求客户端发送 `{ type: "register", deviceId }` 进行身份注册
  - 收到 `user_message` 时调用 `SendMessageUseCase.execute()`
  - 将 `onDelta` 回调转为 WebSocket `agent_text_delta` 消息推送给客户端
  - 错误时发送 `error` 事件
- [x] SubTask 7.3: 运行 typecheck 验证

## Task 8: 组装依赖注入（服务入口）

重写 `server/index.ts`，完成完整的依赖注入链。

- [x] SubTask 8.1: 按顺序实例化：Database -> 3 个 Repository -> PiAgentGateway -> SendMessageUseCase -> CronScheduler -> WebSocket Server
- [x] SubTask 8.2: 传入真实的 Repository 给 CronScheduler（替代当前空壳）
- [x] SubTask 8.3: 将 SendMessageUseCase 注入 WebSocket Server
- [x] SubTask 8.4: 添加归档 Cron 任务
- [x] SubTask 8.5: 运行 typecheck + 启动服务验证

## Task 9: 修复 Pi Agent Gateway ✅

修复 `pi-agent.gateway.ts` 中的事件处理和消息转换。

- [x] SubTask 9.1: 添加 `event.assistantMessageEvent` 空值检查
- [x] SubTask 9.2: 将 domain `Message[]` 转换为 Pi SDK 的 `Context.messages` 格式（`UserMessage` / `AssistantMessage`）
- [x] SubTask 9.3: 在 `pi.config.ts` 中导出 `apiKey` 供 gateway 使用
- [x] SubTask 9.4: 运行 typecheck 验证

## Task 10: 添加 Next.js 健康检查端点

- [x] SubTask 10.1: 创建 `apps/web/src/app/api/health/route.ts`，返回 `{ status: "ok", timestamp }`
- [x] SubTask 10.2: 验证 Next.js dev server 启动正常

## Task 11: 实现 Expo 移动端聊天 UI

- [x] SubTask 11.1: 安装依赖：`zustand`、`react-native-safe-area-context`
- [x] SubTask 11.2: 创建 `src/lib/websocket-client.ts`
  - WebSocket 连接单例
  - 自动重连（指数退避，max 30s）
  - 事件监听器注册（`onMessage`、`onDelta`、`onComplete`、`onError`、`onStatusChange`）
  - `connect(url, deviceId)` / `sendMessage(conversationId, content)` / `disconnect()`
- [x] SubTask 11.3: 创建 `src/store/chat-store.ts`（Zustand）
  - `messages: Message[]` — 当前对话消息列表
  - `connectionStatus: "connected" | "disconnected" | "reconnecting"`
  - `isStreaming: boolean` — AI 是否正在回复
  - `addMessage(msg)` / `appendDelta(delta)` / `setConnectionStatus(status)`
- [x] SubTask 11.4: 创建 `src/screens/ChatScreen.tsx`
  - FlatList 渲染消息列表（用户消息右对齐，AI 消息左对齐）
  - 底部 TextInput + 发送按钮
  - 连接状态指示器（顶部横条）
  - 发送时调用 WebSocket client，接收时更新 store
- [x] SubTask 11.5: 更新 `App.tsx`，用 SafeAreaView 包裹 ChatScreen
- [x] SubTask 11.6: 运行 typecheck 验证

# Task Dependencies

- Task 1（架构修复）在所有其他 Task 之前
- Task 2（配置）独立，可与 Task 1 并行
- Task 3, 4, 5（Repository 实现）依赖 Task 1（domain 接口稳定后实现），三者之间互相独立
- Task 6（归档服务）依赖 Task 4（Message Repository）
- Task 7（WebSocket 重写）依赖 Task 1 + Task 8 的接口定义
- Task 8（依赖注入组装）依赖 Task 1, 2, 3, 4, 5, 7, 9
- Task 9（Pi Gateway 修复）依赖 Task 2（config 完善后）
- Task 10（健康检查）独立，可并行
- Task 11（移动端 UI）依赖 Task 7（WebSocket 协议确定后），可与后端 Task 并行开发

# 执行顺序建议

1. 并行：Task 1 + Task 2 + Task 10
2. 并行：Task 3 + Task 4 + Task 5 + Task 9 + Task 11
3. 串行：Task 6（依赖 Task 4）
4. 串行：Task 7（依赖 Task 1）
5. 串行：Task 8（依赖上述所有 Task）
