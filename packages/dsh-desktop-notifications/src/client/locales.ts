export const en = {
  completed: "Task completed",
  failed: "Task failed or could not finish",
  waiting: "Waiting for your action",
  fallback: "Harness task",
};
export type LocaleKey = keyof typeof en;
export const zh: Record<LocaleKey, string> = {
  completed: "任务已完成",
  failed: "任务失败或未能完成",
  waiting: "等待你的操作",
  fallback: "Harness 任务",
};
