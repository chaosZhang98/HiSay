# Checklist

## 架构修复

- [x] `IAgentGateway` 接口定义在 `domain/agent-gateway.ts`，而非 infrastructure 层
- [x] `infrastructure/agent/agent-gateway.ts` 已删除
- [x] `send-message.usecase.ts` 的 import 指向 domain 层
- [x] `pi-agent.gateway.ts` 的 import 指向 domain 层

## 配置完整性

- [x] `pi.config.ts` 包含 `MIMO_API_KEY` 的环境变量读取
- [x] `database.ts` 启用 `PRAGMA foreign_keys = ON`
- [x] `.env.example` 包含所有 6 个必需变量（`MIMO_BASE_URL`, `MIMO_API_KEY`, `MIMO_MODEL`, `WS_PORT`, `DB_PATH`, `CRON_SCHEDULE`）

## SQLite Repository 实现

- [x] `SQLiteConversationRepository` 实现了 `IConversationRepository` 全部方法
- [x] `SQLiteMessageRepository` 实现了 `IMessageRepository` 全部方法
- [x] `SQLiteScheduledTaskRepository` 实现了 `IScheduledTaskRepository` 全部方法
- [x] `archiveBefore()` 正确压缩内容并写入 `archives` 表
- [x] 所有 Repository 通过 typecheck

## 归档服务

- [x] 归档服务查询 90 天前未归档消息
- [x] VACUUM 每 30 天执行一次

## WebSocket 服务器

- [x] `ConnectionManager` 维护 `deviceId -> WebSocket` 映射
- [x] Ping/Pong 心跳 30 秒间隔
- [x] 连续 2 次未 pong 自动断开
- [x] `user_message` 事件路由到 `SendMessageUseCase`
- [x] LLM 流式 delta 通过 `agent_text_delta` 推送给对应客户端
- [x] 错误时发送 `error` 事件
- [x] 消息发送完毕后发送 `agent_message_complete`

## Pi Agent Gateway

- [x] 事件处理包含空值检查
- [x] domain Message 正确转换为 Pi SDK 格式
- [x] API key 从配置传递到 Pi SDK

## 依赖注入

- [x] `server/index.ts` 按正确顺序实例化所有依赖
- [x] Repository 传入真实 SQLite 实现（非空壳）
- [x] `SendMessageUseCase` 注入到 WebSocket server
- [x] 服务启动后日志输出正确（db connected, ws listening, cron started）

## 健康检查

- [x] `/api/health` 返回 `{ status: "ok", timestamp }`

## 移动端

- [x] WebSocket 客户端单例实现，支持自动重连
- [x] Zustand store 管理消息列表和连接状态
- [x] ChatScreen 渲染消息列表（用户右对齐，AI 左对齐）
- [x] 底部输入框 + 发送按钮
- [x] 连接状态指示器显示在界面顶部
- [x] 移动端通过 typecheck

## 整体验证

- [x] `pnpm --filter @hisay/shared typecheck` 通过
- [x] `pnpm --filter @hisay/web typecheck` 通过
- [x] `pnpm --filter @hisay/mobile typecheck` 通过
- [x] 服务启动后可连接 WebSocket 并发送/接收消息
