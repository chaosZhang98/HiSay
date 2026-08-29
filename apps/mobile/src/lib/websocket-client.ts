import type {
  AguiMessage,
  UserMessageEvent,
  AgentTextDeltaEvent,
  AgentMessageCompleteEvent,
  ErrorEvent,
  TaskRunResultEvent,
  TaskResultMessageEvent,
  SessionInfoEvent,
  HistoryMessagesEvent,
  ArchivedMessagesEvent,
  HistoryMessageItem,
  ConversationListEvent,
  ConversationItem,
  ConversationChangedEvent,
  TaskListEvent,
  TaskChangedEvent,
  TaskRunsEvent,
  ScheduledTaskItem,
  TaskRunItem,
} from "@agent/shared";

type EventListener = {
  onMessage?: (msg: AguiMessage) => void;
  onDelta?: (delta: string, messageId: string) => void;
  onComplete?: (messageId: string) => void;
  onError?: (code: string, message: string) => void;
  onTaskResult?: (result: TaskRunResultEvent) => void;
  onTaskResultMessage?: (
    conversationId: string,
    message: HistoryMessageItem,
  ) => void;
  onSession?: (conversationId: string, messages: HistoryMessageItem[]) => void;
  onHistory?: (conversationId: string, messages: HistoryMessageItem[]) => void;
  onArchivedMessages?: (conversationId: string, messages: HistoryMessageItem[]) => void;
  onConversationList?: (conversations: ConversationItem[]) => void;
  onConversationChanged?: (conversation: ConversationItem, deleted?: boolean) => void;
  onTaskList?: (tasks: ScheduledTaskItem[]) => void;
  onTaskChanged?: (task: ScheduledTaskItem, deleted?: boolean) => void;
  onTaskRuns?: (taskId: string, runs: TaskRunItem[]) => void;
  onStatusChange?: (status: "connected" | "disconnected" | "reconnecting") => void;
};

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url = "";
  private deviceId = "";
  private listeners: EventListener = {};
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private maxReconnectDelay = 30000;

  setListeners(listeners: EventListener) {
    this.listeners = listeners;
  }

  connect(url: string, deviceId: string) {
    this.url = url;
    this.deviceId = deviceId;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect() {
    this.ws = new WebSocket(this.url);
    this.listeners.onStatusChange?.("reconnecting");

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // 发送注册消息
      this.ws?.send(JSON.stringify({ type: "register", deviceId: this.deviceId }));
      this.listeners.onStatusChange?.("connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as AguiMessage;
        this.listeners.onMessage?.(msg);
        this.handleEvent(msg);
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.listeners.onStatusChange?.("disconnected");
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private handleEvent(msg: AguiMessage) {
    switch (msg.type) {
      case "agent_text_delta":
        this.listeners.onDelta?.(
          (msg as AgentTextDeltaEvent).delta,
          (msg as AgentTextDeltaEvent).messageId
        );
        break;
      case "agent_message_complete":
        this.listeners.onComplete?.(
          (msg as AgentMessageCompleteEvent).messageId
        );
        break;
      case "error":
        this.listeners.onError?.(
          (msg as ErrorEvent).code,
          (msg as ErrorEvent).message
        );
        break;
      case "task_run_result":
        this.listeners.onTaskResult?.(msg as TaskRunResultEvent);
        break;
      case "task_result_message":
        this.listeners.onTaskResultMessage?.(
          (msg as TaskResultMessageEvent).conversationId,
          (msg as TaskResultMessageEvent).message
        );
        break;
      case "session_info":
        this.listeners.onSession?.(
          (msg as SessionInfoEvent).conversationId,
          (msg as SessionInfoEvent).messages
        );
        break;
      case "history_messages":
        this.listeners.onHistory?.(
          (msg as HistoryMessagesEvent).conversationId,
          (msg as HistoryMessagesEvent).messages
        );
        break;
      case "archived_messages":
        this.listeners.onArchivedMessages?.(
          (msg as ArchivedMessagesEvent).conversationId,
          (msg as ArchivedMessagesEvent).messages
        );
        break;
      case "conversation_list":
        this.listeners.onConversationList?.(
          (msg as ConversationListEvent).conversations
        );
        break;
      case "conversation_changed":
        this.listeners.onConversationChanged?.(
          (msg as ConversationChangedEvent).conversation,
          (msg as ConversationChangedEvent).deleted
        );
        break;
      case "task_list":
        this.listeners.onTaskList?.((msg as TaskListEvent).tasks);
        break;
      case "task_changed":
        this.listeners.onTaskChanged?.(
          (msg as TaskChangedEvent).task,
          (msg as TaskChangedEvent).deleted
        );
        break;
      case "task_runs":
        this.listeners.onTaskRuns?.(
          (msg as TaskRunsEvent).taskId,
          (msg as TaskRunsEvent).runs
        );
        break;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  sendMessage(conversationId: string, content: string) {
    const event: UserMessageEvent = {
      type: "user_message",
      messageId: crypto.randomUUID(),
      conversationId,
      content,
      timestamp: new Date().toISOString(),
    };
    this.ws?.send(JSON.stringify(event));
  }

  /** 请求当前设备的会话列表。 */
  fetchConversations() {
    this.ws?.send(
      JSON.stringify({
        type: "fetch_conversations",
        timestamp: new Date().toISOString(),
      })
    );
  }

  /** 新建会话（服务端创建后返回 session_info）。 */
  createConversation() {
    this.ws?.send(
      JSON.stringify({
        type: "create_conversation",
        timestamp: new Date().toISOString(),
      })
    );
  }

  /** 重命名会话（服务端返回 conversation_changed）。 */
  renameConversation(conversationId: string, title: string) {
    this.ws?.send(
      JSON.stringify({
        type: "rename_conversation",
        conversationId,
        title,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /** 删除会话（服务端返回 conversation_changed + deleted）。 */
  deleteConversation(conversationId: string) {
    this.ws?.send(
      JSON.stringify({
        type: "delete_conversation",
        conversationId,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /** 请求某个会话的历史消息（服务端返回 history_messages）。 */
  fetchHistory(conversationId: string) {
    this.ws?.send(
      JSON.stringify({
        type: "fetch_history",
        conversationId,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /** 请求某个会话的归档消息（服务端返回 archived_messages）。 */
  fetchArchivedMessages(conversationId: string) {
    this.ws?.send(
      JSON.stringify({
        type: "fetch_archived_messages",
        conversationId,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /** 请求定时任务列表（服务端返回 task_list）。 */
  listTasks() {
    this.ws?.send(
      JSON.stringify({ type: "list_tasks", timestamp: new Date().toISOString() })
    );
  }

  /** 创建定时任务（服务端返回 task_changed）。 */
  createTask(cronExpression: string, prompt: string) {
    this.ws?.send(
      JSON.stringify({
        type: "create_task",
        cronExpression,
        prompt,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /** 启用/禁用定时任务（服务端返回 task_changed）。 */
  toggleTask(taskId: string) {
    this.ws?.send(
      JSON.stringify({
        type: "toggle_task",
        taskId,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /** 删除定时任务（服务端返回 task_changed + deleted）。 */
  deleteTask(taskId: string) {
    this.ws?.send(
      JSON.stringify({
        type: "delete_task",
        taskId,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /** 请求任务执行历史（服务端返回 task_runs）。 */
  fetchTaskRuns(taskId: string) {
    this.ws?.send(
      JSON.stringify({
        type: "fetch_task_runs",
        taskId,
        timestamp: new Date().toISOString(),
      })
    );
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WebSocketClient();
