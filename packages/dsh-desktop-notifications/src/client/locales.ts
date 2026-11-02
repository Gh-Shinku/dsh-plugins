export const en = {
  title: "Desktop notifications",
  enabled: "Notify when Harness is in the background",
  test: "Enable and test notification",
  completed: "Task completed",
  failed: "Task failed or could not finish",
  waiting: "Waiting for your action",
  fallback: "Harness task",
  granted: "System notification permission granted",
  default: "Use the button below to allow system notifications",
  denied: "Notifications blocked. Allow them in system notification settings.",
  unsupported: "Notifications are available only in Harness desktop",
  unavailable: "Notification settings are unavailable",
  error: "Could not enable or send notifications",
  testBody: "Desktop task notifications are ready",
};
export type LocaleKey = keyof typeof en;
export const zh: Record<LocaleKey, string> = {
  title: "桌面通知",
  enabled: "Harness 在后台时发送通知",
  test: "启用并测试通知",
  completed: "任务已完成",
  failed: "任务失败或未能完成",
  waiting: "等待你的操作",
  fallback: "Harness 任务",
  granted: "已获得系统通知权限",
  default: "点击下方按钮允许系统通知",
  denied: "通知已被阻止，请在系统通知设置中允许。",
  unsupported: "通知仅在 Harness desktop 中可用",
  unavailable: "通知设置暂不可用",
  error: "无法启用或发送通知",
  testBody: "桌面任务通知已就绪",
};
export type Translate = (key: LocaleKey) => string;
