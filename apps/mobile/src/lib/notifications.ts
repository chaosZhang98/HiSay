import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { TaskRunResultEvent } from "@agent/shared";

// 通知在前台也要展示
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** 请求通知权限并返回是否获得授权。 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

/** 展示一条本地通知（定时任务结果）。 */
export async function showTaskResultNotification(
  result: TaskRunResultEvent,
): Promise<void> {
  const title =
    result.status === "success" ? "定时任务完成" : "定时任务执行失败";
  const body =
    result.status === "success"
      ? result.output?.slice(0, 200) ?? "任务已执行完成"
      : result.error ?? "任务执行出错";

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { taskId: result.taskId, runId: result.runId },
    },
    trigger: null, // null = 立即展示
  });
}
