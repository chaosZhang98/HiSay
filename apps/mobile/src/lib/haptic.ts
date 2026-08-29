/**
 * 触觉反馈统一封装：
 * - 原生平台走 expo-haptics（iOS Core Haptics / Android Vibrator）
 * - Web 平台走 navigator.vibrate（若可用），否则静默无副作用
 *
 * 所有调用都允许失败，避免感知 SDK 缺失时崩溃。
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

type HapticKind = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export function triggerHaptic(kind: HapticKind = "light"): void {
  if (Platform.OS === "web") {
    const durations: Record<HapticKind, number> = {
      light: 8,
      medium: 15,
      heavy: 25,
      success: 20,
      warning: 30,
      error: 40,
    };
    try {
      (navigator as any).vibrate?.(durations[kind] ?? 8);
    } catch {
      // ignore
    }
    return;
  }

  try {
    switch (kind) {
      case "light":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        break;
      case "medium":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        break;
      case "heavy":
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        break;
      case "success":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
      case "warning":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        break;
      case "error":
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        break;
    }
  } catch {
    // ignore
  }
}
