/**
 * 一次性 UI 引导标记（持久化到 AsyncStorage），避免重复播放。
 * 全部 key 集中在此便于后续清理。
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "ui-guide-v1:";
const KEY_MINIAPP_PEEK = `${KEY_PREFIX}miniapp-peek`;

async function readFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === "1";
  } catch {
    return false;
  }
}

async function setFlag(key: string, value = true): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value ? "1" : "0");
  } catch {
    // 持久化失败不影响功能运行
  }
}

export async function shouldShowMiniAppPeek(): Promise<boolean> {
  return !(await readFlag(KEY_MINIAPP_PEEK));
}

export function markMiniAppPeekSeen(): Promise<void> {
  return setFlag(KEY_MINIAPP_PEEK);
}
