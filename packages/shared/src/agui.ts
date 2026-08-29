export type AguiMessage =
  | RegisterEvent
  | UserMessageEvent
  | AgentTextDeltaEvent
  | AgentToolCallEvent
  | AgentMessageCompleteEvent
  | TaskRunResultEvent
  | TaskResultMessageEvent
  | FetchHistoryEvent
  | HistoryMessagesEvent
  | FetchArchivedMessagesEvent
  | ArchivedMessagesEvent
  | SessionInfoEvent
  | FetchConversationsEvent
  | CreateConversationEvent
  | RenameConversationEvent
  | DeleteConversationEvent
  | ConversationListEvent
  | ConversationChangedEvent
  | CreateTaskEvent
  | ListTasksEvent
  | ToggleTaskEvent
  | DeleteTaskEvent
  | TaskListEvent
  | TaskChangedEvent
  | FetchTaskRunsEvent
  | TaskRunsEvent
  | ErrorEvent
  | ConnectionStatusEvent;

export interface RegisterEvent extends BaseAguiEvent {
  type: "register";
  deviceId: string;
}

export interface BaseAguiEvent {
  type: string;
  timestamp: string;
}

export interface UserMessageEvent extends BaseAguiEvent {
  type: "user_message";
  messageId: string;
  conversationId: string;
  content: string;
}

export interface AgentTextDeltaEvent extends BaseAguiEvent {
  type: "agent_text_delta";
  messageId: string;
  conversationId: string;
  delta: string;
}

export interface AgentToolCallEvent extends BaseAguiEvent {
  type: "agent_tool_call";
  messageId: string;
  conversationId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface AgentMessageCompleteEvent extends BaseAguiEvent {
  type: "agent_message_complete";
  messageId: string;
  conversationId: string;
}

export interface TaskRunResultEvent extends BaseAguiEvent {
  type: "task_run_result";
  taskId: string;
  runId: string;
  status: "success" | "failed";
  output?: string;
  error?: string;
}

/** 定时任务执行完成后，结果作为一条 agent 消息回写到来源会话。 */
export interface TaskResultMessageEvent extends BaseAguiEvent {
  type: "task_result_message";
  conversationId: string;
  message: HistoryMessageItem;
}

/** 客户端请求某个会话的历史消息（应用重启后恢复对话）。 */
export interface FetchHistoryEvent extends BaseAguiEvent {
  type: "fetch_history";
  conversationId: string;
}

/** 客户端会话历史中单条消息的形态。 */
export interface HistoryMessageItem {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt: string;
}

/** 服务端返回的会话历史。 */
export interface HistoryMessagesEvent extends BaseAguiEvent {
  type: "history_messages";
  conversationId: string;
  messages: HistoryMessageItem[];
}

/** 客户端请求某个会话的归档消息（90 天前的冷数据）。 */
export interface FetchArchivedMessagesEvent extends BaseAguiEvent {
  type: "fetch_archived_messages";
  conversationId: string;
}

/** 服务端返回的归档消息。 */
export interface ArchivedMessagesEvent extends BaseAguiEvent {
  type: "archived_messages";
  conversationId: string;
  messages: HistoryMessageItem[];
}

/** 客户端注册后，服务端返回该设备的会话信息与历史消息（重启/重装后恢复对话）。 */
export interface SessionInfoEvent extends BaseAguiEvent {
  type: "session_info";
  conversationId: string;
  messages: HistoryMessageItem[];
}

/** 客户端请求当前设备的会话列表。 */
export interface FetchConversationsEvent extends BaseAguiEvent {
  type: "fetch_conversations";
}

/** 客户端新建一个会话。 */
export interface CreateConversationEvent extends BaseAguiEvent {
  type: "create_conversation";
}

/** 客户端重命名会话。 */
export interface RenameConversationEvent extends BaseAguiEvent {
  type: "rename_conversation";
  conversationId: string;
  title: string;
}

/** 客户端删除会话。 */
export interface DeleteConversationEvent extends BaseAguiEvent {
  type: "delete_conversation";
  conversationId: string;
}

/** 服务端确认会话变更（重命名/删除后返回最新会话项）。 */
export interface ConversationChangedEvent extends BaseAguiEvent {
  type: "conversation_changed";
  conversation: ConversationItem;
  /** 删除时该项标记为已删除。 */
  deleted?: boolean;
}

/** 会话列表中的一项（preview 为最近一条消息的摘要）。 */
export interface ConversationItem {
  id: string;
  title: string;
  updatedAt: string;
  preview?: string;
}

/** 服务端返回的会话列表。 */
export interface ConversationListEvent extends BaseAguiEvent {
  type: "conversation_list";
  conversations: ConversationItem[];
}

/** 客户端创建一个定时任务。 */
export interface CreateTaskEvent extends BaseAguiEvent {
  type: "create_task";
  cronExpression: string;
  prompt: string;
}

/** 客户端请求定时任务列表。 */
export interface ListTasksEvent extends BaseAguiEvent {
  type: "list_tasks";
}

/** 客户端启用/禁用某个定时任务。 */
export interface ToggleTaskEvent extends BaseAguiEvent {
  type: "toggle_task";
  taskId: string;
}

/** 客户端删除某个定时任务。 */
export interface DeleteTaskEvent extends BaseAguiEvent {
  type: "delete_task";
  taskId: string;
}

/** 定时任务列表项。 */
export interface ScheduledTaskItem {
  id: string;
  cronExpression: string;
  prompt: string;
  isEnabled: boolean;
  lastRunAt?: string;
  createdAt: string;
}

/** 服务端返回的定时任务列表。 */
export interface TaskListEvent extends BaseAguiEvent {
  type: "task_list";
  tasks: ScheduledTaskItem[];
}

/** 服务端确认任务变更（创建/启停/删除后返回最新任务项）。 */
export interface TaskChangedEvent extends BaseAguiEvent {
  type: "task_changed";
  task: ScheduledTaskItem;
  /** 删除时该项标记为已删除。 */
  deleted?: boolean;
}

/** 客户端请求某个任务的执行历史。 */
export interface FetchTaskRunsEvent extends BaseAguiEvent {
  type: "fetch_task_runs";
  taskId: string;
}

/** 定时任务单次执行记录。 */
export interface TaskRunItem {
  id: string;
  taskId: string;
  status: "success" | "failed" | "running";
  output?: string;
  error?: string;
  runAt: string;
}

/** 服务端返回的任务执行历史。 */
export interface TaskRunsEvent extends BaseAguiEvent {
  type: "task_runs";
  taskId: string;
  runs: TaskRunItem[];
}

export interface ErrorEvent extends BaseAguiEvent {
  type: "error";
  code: string;
  message: string;
}

export interface ConnectionStatusEvent extends BaseAguiEvent {
  type: "connection_status";
  status: "connected" | "disconnected" | "reconnecting";
}