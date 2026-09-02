import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import type { TaskRunResult } from "@hisay/shared";
import { restApi } from "./rest-api";
import { showTaskResultNotification } from "./notifications";
import { openConversation } from "./chat-session";
import { useChatStore } from "../store/chat-store";

const SEEN_KEY = "hisay.task-alert-seen-ids";
const POLL_MS = 30_000;

async function loadSeenIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

async function saveSeenIds(ids: Set<string>): Promise<void> {
  const trimmed = [...ids].slice(-200);
  await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
}

async function tick(seedOnly: boolean): Promise<void> {
  const seen = await loadSeenIds();
  const { results } = await restApi.taskAlerts();
  const fresh: TaskRunResult[] = [];
  for (const result of results) {
    if (seen.has(result.runId)) continue;
    seen.add(result.runId);
    fresh.push(result);
  }
  await saveSeenIds(seen);
  if (seedOnly || fresh.length === 0) return;

  for (const result of fresh) {
    await showTaskResultNotification(result);
    const currentId = useChatStore.getState().conversationId;
    if (result.conversationId && result.conversationId === currentId) {
      await openConversation(result.conversationId);
    }
  }
}

export function startTaskAlertPoller(): () => void {
  void tick(true).catch((err) => {
    console.error("[task-alerts] seed failed", err);
  });

  const timer = setInterval(() => {
    void tick(false).catch((err) => {
      console.error("[task-alerts] poll failed", err);
    });
  }, POLL_MS);

  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void tick(false).catch((err) => {
        console.error("[task-alerts] resume poll failed", err);
      });
    }
  });

  return () => {
    clearInterval(timer);
    subscription.remove();
  };
}
