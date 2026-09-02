import { timelineFromHistory, useChatStore } from "../store/chat-store";
import { useSurfaceStore } from "../a2ui/surface-store";
import { agentTransport, type AgentClientEvent, type AgentMessageInput } from "./agent-transport";
import { restApi } from "./rest-api";
import { createUuid } from "./uuid";

function applyAgentEvent(event: AgentClientEvent) {
  const store = useChatStore.getState();
  if (event.kind === "text-started" && event.messageId) {
    store.appendDelta("", event.messageId);
    return;
  }
  if (event.kind === "text-delta" && event.messageId && event.delta) {
    store.appendDelta(event.delta, event.messageId);
    return;
  }
  if (event.kind === "text-completed" && event.messageId) {
    store.finishStreaming(event.messageId);
    return;
  }
  if (event.kind === "surface" && event.activityId && event.content) {
    store.upsertActivity(
      {
        id: event.activityId,
        role: "activity",
        activityType: event.activityType ?? "a2ui-surface",
        content: event.content,
        createdAt: new Date().toISOString(),
      },
      true,
    );
    useSurfaceStore.getState().applyActivitySnapshot(event.activityId, event.content, true);
    return;
  }
  if (event.kind === "run-failed") {
    store.failStreaming(store.streamingMessageId, event.message || "回复失败，请再试一次。");
  }
}

function officialMessages(): AgentMessageInput[] {
  return useChatStore
    .getState()
    .messages.filter((item): item is Extract<typeof item, { role: "user" | "agent" }> => item.role !== "activity")
    .map((item) => ({
      id: item.id,
      role: item.role === "agent" ? "assistant" : "user",
      content: item.content,
    }));
}

export async function bootstrapSession(): Promise<void> {
  const session = await restApi.session();
  const timeline = timelineFromHistory(session.messages);
  useChatStore.getState().loadSession(session.conversation.id, timeline);
  useSurfaceStore.getState().loadActivities(
    timeline.filter((item) => item.role === "activity"),
  );
  const list = await restApi.listConversations();
  useChatStore.getState().loadConversations(list.conversations);
  useChatStore.getState().setConnectionStatus("connected");
}

export async function refreshConversations(): Promise<void> {
  const list = await restApi.listConversations();
  useChatStore.getState().loadConversations(list.conversations);
}

export async function openConversation(conversationId: string): Promise<void> {
  const history = await restApi.conversationHistory(conversationId);
  const timeline = timelineFromHistory(history.messages);
  useChatStore.getState().loadSession(conversationId, timeline);
  useSurfaceStore.getState().loadActivities(
    timeline.filter((item) => item.role === "activity"),
  );
}

export async function createConversation(): Promise<void> {
  const created = await restApi.createConversation();
  useChatStore.getState().loadSession(created.conversation.id, []);
  useSurfaceStore.getState().clear();
  await refreshConversations();
}

export async function renameConversation(conversationId: string, title: string): Promise<void> {
  const result = await restApi.renameConversation(conversationId, title);
  useChatStore.getState().upsertConversation(result.conversation);
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const wasActive = useChatStore.getState().conversationId === conversationId;
  await restApi.deleteConversation(conversationId);
  useChatStore.getState().upsertConversation(
    { id: conversationId, title: "", updatedAt: new Date().toISOString() },
    true,
  );
  if (wasActive) {
    useSurfaceStore.getState().clear();
    await createConversation();
  }
}

export async function loadArchived(conversationId: string): Promise<void> {
  const result = await restApi.archivedMessages(conversationId);
  useChatStore.getState().loadArchivedMessages(conversationId, result.messages);
}

export async function runAgentTurn(options?: {
  text?: string;
  action?: {
    surfaceId: string;
    name: string;
    sourceComponentId?: string;
    context?: Record<string, unknown>;
  };
}): Promise<void> {
  const store = useChatStore.getState();
  const conversationId = store.conversationId;
  if (!conversationId) return;

  if (options?.text) {
    store.addMessage({
      id: createUuid(),
      role: "user",
      content: options.text,
      createdAt: new Date().toISOString(),
    });
  }

  const placeholderId = createUuid();
  store.addMessage({
    id: placeholderId,
    role: "agent",
    content: "",
    createdAt: new Date().toISOString(),
  });
  store.setStreaming(true);
  useChatStore.setState({ streamingMessageId: placeholderId });

  try {
    await agentTransport.run({
      threadId: conversationId,
      messages: officialMessages(),
      action: options?.action,
      onEvent: applyAgentEvent,
    });
    if (useChatStore.getState().isStreaming) {
      useChatStore.getState().finishStreaming(
        useChatStore.getState().streamingMessageId ?? placeholderId,
      );
    }
  } catch (err) {
    useChatStore.getState().failStreaming(
      placeholderId,
      err instanceof Error ? err.message : "回复失败，请再试一次。",
    );
  }
}
