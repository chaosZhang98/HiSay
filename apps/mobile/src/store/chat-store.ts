import { create } from "zustand";
import type {
  ConversationItem,
  ConversationTimelineItem,
  HistoryMessageItem,
  ScheduledTaskItem,
  TaskRunItem,
} from "@hisay/shared";
import { isActivityMessageItem } from "@hisay/shared";

export type ChatTextMessage = {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt?: string;
};

export type ChatActivityMessage = {
  id: string;
  role: "activity";
  activityType: string;
  content: Record<string, unknown>;
  createdAt?: string;
};

export type ChatTimelineItem = ChatTextMessage | ChatActivityMessage;

export function timelineFromHistory(
  history: ConversationTimelineItem[],
): ChatTimelineItem[] {
  return history.map((item) =>
    isActivityMessageItem(item)
      ? {
          id: item.id,
          role: "activity" as const,
          activityType: item.activityType,
          content: item.content,
          createdAt: item.createdAt,
        }
      : {
          id: item.id,
          role: item.role,
          content: item.content,
          createdAt: item.createdAt,
        },
  );
}

interface ChatState {
  messages: ChatTimelineItem[];
  conversations: ConversationItem[];
  conversationListVisible: boolean;
  tasks: ScheduledTaskItem[];
  taskRuns: TaskRunItem[];
  activeTaskId: string | null;
  archivedMessages: { conversationId: string; messages: HistoryMessageItem[] } | null;
  connectionStatus: "connected" | "disconnected" | "reconnecting";
  isStreaming: boolean;
  streamingMessageId: string | null;
  conversationId: string;

  addMessage: (msg: ChatTextMessage) => void;
  appendMessage: (msg: ChatTextMessage) => void;
  appendDelta: (delta: string, messageId: string) => void;
  finishStreaming: (messageId: string) => void;
  failStreaming: (messageId: string | null, errorText: string) => void;
  upsertActivity: (item: ChatActivityMessage, replace?: boolean) => void;
  loadSession: (conversationId: string, history: ChatTimelineItem[]) => void;
  loadConversations: (conversations: ConversationItem[]) => void;
  upsertConversation: (conversation: ConversationItem, deleted?: boolean) => void;
  setConversationId: (conversationId: string) => void;
  clearMessages: () => void;
  toggleConversationList: (visible: boolean) => void;
  loadTasks: (tasks: ScheduledTaskItem[]) => void;
  upsertTask: (task: ScheduledTaskItem, deleted?: boolean) => void;
  loadTaskRuns: (taskId: string, runs: TaskRunItem[]) => void;
  setActiveTask: (taskId: string | null) => void;
  loadArchivedMessages: (
    conversationId: string,
    messages: HistoryMessageItem[]
  ) => void;
  clearArchivedMessages: () => void;
  setConnectionStatus: (
    status: "connected" | "disconnected" | "reconnecting"
  ) => void;
  setStreaming: (streaming: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  conversations: [],
  conversationListVisible: false,
  tasks: [],
  taskRuns: [],
  activeTaskId: null,
  archivedMessages: null,
  connectionStatus: "disconnected",
  isStreaming: false,
  streamingMessageId: null,
  conversationId: "",

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

  appendMessage: (msg) =>
    set((state) => ({
      messages: state.messages.some((m) => m.id === msg.id)
        ? state.messages
        : [...state.messages, msg],
    })),

  appendDelta: (delta, messageId) =>
    set((state) => {
      const existing = state.messages.find((m) => m.id === messageId);
      if (existing?.role === "activity") return state;

      const placeholder =
        !existing && state.streamingMessageId
          ? state.messages.find(
              (m) => m.id === state.streamingMessageId && m.role === "agent",
            )
          : undefined;
      const target = existing ?? placeholder;

      if (!target) {
        return {
          messages: [
            ...state.messages,
            { id: messageId, role: "agent", content: delta },
          ],
          streamingMessageId: messageId,
        };
      }
      if (target.role === "activity") return state;

      return {
        streamingMessageId: messageId,
        messages: state.messages.map((m) =>
          m.id === target.id && m.role !== "activity"
            ? { ...m, id: messageId, content: m.content + delta }
            : m,
        ),
      };
    }),

  finishStreaming: (messageId) =>
    set((state) => {
      const existing = state.messages.find((m) => m.id === messageId);
      if (existing?.role === "activity") {
        return { isStreaming: false, streamingMessageId: null };
      }
      return {
        isStreaming: false,
        streamingMessageId: null,
        messages: existing
          ? state.messages
          : [
              ...state.messages,
              {
                id: messageId,
                role: "agent",
                content: "",
                createdAt: new Date().toISOString(),
              },
            ],
      };
    }),

  failStreaming: (messageId, errorText) =>
    set((state) => {
      const id = messageId ?? state.streamingMessageId;
      return {
        isStreaming: false,
        streamingMessageId: null,
        messages: state.messages.map((m) =>
          id && m.id === id && m.role === "agent" && !m.content
            ? { ...m, content: errorText }
            : m,
        ),
      };
    }),

  upsertActivity: (item, replace = true) =>
    set((state) => {
      const index = state.messages.findIndex((m) => m.id === item.id);
      if (index >= 0) {
        const current = state.messages[index];
        if (current.role !== "activity") return state;
        if (!replace) return state;
        const next = [...state.messages];
        next[index] = item;
        return { messages: next };
      }
      return { messages: [...state.messages, item] };
    }),

  loadSession: (conversationId, history) =>
    set({
      conversationId,
      messages: history,
      isStreaming: false,
      streamingMessageId: null,
    }),

  loadConversations: (conversations) => set({ conversations }),
  upsertConversation: (conversation, deleted) =>
    set((state) => ({
      conversations: deleted
        ? state.conversations.filter((c) => c.id !== conversation.id)
        : state.conversations.some((c) => c.id === conversation.id)
          ? state.conversations.map((c) => (c.id === conversation.id ? conversation : c))
          : [conversation, ...state.conversations],
    })),
  setConversationId: (conversationId) => set({ conversationId }),
  clearMessages: () =>
    set({ messages: [], isStreaming: false, streamingMessageId: null }),
  toggleConversationList: (visible) => set({ conversationListVisible: visible }),
  loadTasks: (tasks) => set({ tasks }),
  upsertTask: (task, deleted) =>
    set((state) => ({
      tasks: deleted
        ? state.tasks.filter((t) => t.id !== task.id)
        : state.tasks.some((t) => t.id === task.id)
          ? state.tasks.map((t) => (t.id === task.id ? task : t))
          : [task, ...state.tasks],
    })),
  loadTaskRuns: (taskId, runs) => set({ taskRuns: runs, activeTaskId: taskId }),
  setActiveTask: (taskId) => set({ activeTaskId: taskId }),
  loadArchivedMessages: (conversationId, messages) =>
    set({ archivedMessages: { conversationId, messages } }),
  clearArchivedMessages: () => set({ archivedMessages: null }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
}));
