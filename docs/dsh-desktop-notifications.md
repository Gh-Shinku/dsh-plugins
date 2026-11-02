# Desktop notifications

`@shinku-ever/dsh-desktop-notifications` sends system notifications when DeepSeek Harness desktop is hidden, minimized, or does not have focus. It targets Harness **0.2.1-rc.5**.

## Install

In Harness desktop's plugin manager, install `@shinku-ever/dsh-desktop-notifications` from npm once a package has been published, or select a locally packed `.tgz` archive. For local development, run `pnpm build` and `pnpm pack:check` at the repository root; the archive is written under `.artifacts/`.

Restart or reload the desktop client when the native plugin manager requests it. Installing the plugin enables notifications immediately on client activation; there is no settings page, switch, or test button. Package publication is manual.

## Use

Install the plugin and restart Harness desktop. No additional activation step is required. When notification permission is undetermined, the desktop client requests it once during plugin activation. If permission is denied or unavailable, the plugin does not repeatedly request it; allow Harness notifications through your system settings if needed. Disable or uninstall the plugin in the native plugin manager to stop its notifications.

The plugin reports:

- Successful task completion.
- Failed, blocked, or token-limited tasks.
- A new pending user interaction, including approval, questions, and plan confirmation.

Manual cancellation and subagent sessions do not generate their own notifications. Foreground events are suppressed and are not sent later. Notifications contain only the durable session title and status; a missing title uses “Harness task”. Answers, questions, commands, and raw errors are excluded.

Click a notification to try to activate Harness and open its conversation. Viewing that conversation while Harness is in front clears its notification. Returning to Harness without viewing the conversation does not clear it. A newer notification replaces an older one for the same session.

## Limits

- **System taskbar/Dock badges are deferred.** Harness does not currently expose a public plugin interface for these badges.
- The client must remain running and connected. There is no push service, durable unread storage, startup replay, or recovery of notifications missed while disconnected.
- The ordinary Web client is not enabled. Desktop notification support, permission, sound, delivery, and window activation depend on Electron and OS notification/focus settings. Installing the plugin does not override Do Not Disturb or a system notification denial.
- Existing pending interactions are treated as a baseline when the plugin starts, is re-enabled, or reconnects. Only new interactions trigger a notification. Only live appended turn-end records trigger completion notifications; initial history and history replacement are ignored.
- A task that finishes before its live journal subscription opens may be missed. The plugin does not read history to manufacture a completion alert.
- Closing a notification does not approve or answer anything. Use the conversation's native controls.

## Implementation

The Host half is an empty bundle entrypoint without configuration. The client starts immediately and uses native session references and journals, `uiSession.sessionStatus`, and `uiWorkspace.openSession`. It sends Web Notifications from the renderer and never imports Electron or Host services into its browser bundle. Foreground detection combines visibility with document focus.

Running top-level sessions are retained while their live completion events are observed. An idle status allows five seconds for the final journal record to arrive before releasing its reference. Session removal, connection-generation changes, disabling, and plugin disposal release owned references, subscriptions, timers, and notifications. There are no plugin settings; unread notifications exist only in the current client.

## 手动验收

在 Harness desktop 的插件管理器中导入 `.artifacts/shinku-ever-dsh-desktop-notifications-0.1.1.tgz`，按提示重载客户端。

1. 安装后重启 Harness desktop，无需打开设置或手动启用；确认没有“桌面通知”设置页。
2. 启动任务后切到其他应用或最小化 Harness，确认完成、失败及等待审批／回答／计划确认时分别出现通知，正文只有状态。
3. 保持 Harness 在前台重复以上场景，确认不弹通知；随后切到后台，确认没有补发。
4. 点击通知，确认尝试激活 Harness 并打开对应会话。多个会话有通知时，确认只清除已在前台查看的会话通知。
5. 手动停止任务，确认没有完成通知；检查同一请求不会重复提醒、子代理不会单独提醒。
6. 通过插件管理器停用插件，确认停止通知；重新启用、断线重连或重启客户端时，确认旧通知和历史完成记录不重放；普通 Web 客户端不启用此插件的通知。

系统勿扰模式、通知权限和窗口激活限制需在实际桌面环境确认。自动化测试覆盖插件行为，未代替实际 Windows 通知验收。
