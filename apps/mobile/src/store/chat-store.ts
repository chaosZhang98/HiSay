import { create } from "zustand";
import type {
  ConversationItem,
  HistoryMessageItem,
  ScheduledTaskItem,
  TaskRunItem,
} from "@agent/shared";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  createdAt?: string;
}

interface ChatState {
  messages: ChatMessage[];
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

  addMessage: (msg: ChatMessage) => void;
  appendMessage: (msg: ChatMessage) => void;
  appendDelta: (delta: string, messageId: string) => void;
  finishStreaming: (messageId: string) => void;
  loadSession: (conversationId: string, history: ChatMessage[]) => void;
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
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, content: m.content + delta } : m
      ),
    })),

  finishStreaming: (messageId) =>
    set((state) => ({
      isStreaming: false,
      streamingMessageId: null,
      messages: state.messages.some((m) => m.id === messageId)
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
    })),

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
