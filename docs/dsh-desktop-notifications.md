# Desktop notifications

`@shinku-ever/dsh-desktop-notifications` sends system notifications when DeepSeek Harness desktop is hidden, minimized, or does not have focus.

## Install

In Harness desktop's plugin manager, install `@shinku-ever/dsh-desktop-notifications` from npm, or select a local `.tgz` plugin archive.

Restart or reload the desktop client when the plugin manager requests it. Notifications start automatically when the plugin activates. There is no settings page or additional activation step.

## Use

Install the plugin and restart Harness desktop. No additional activation step is required. When notification permission is undetermined, the desktop client requests it once during plugin activation. If permission is denied or unavailable, the plugin does not repeatedly request it; allow Harness notifications through your system settings if needed. Disable or uninstall the plugin in the native plugin manager to stop its notifications.

The plugin reports:

- Successful task completion.
- Failed, blocked, or token-limited tasks.
- A new pending user interaction, including approval, questions, and plan confirmation.

Manual cancellation and subagent sessions do not generate their own notifications. Foreground events are suppressed and are not sent later. Notifications contain only the session title and status; a missing title uses “Harness task”. Answers, questions, commands, and raw errors are excluded.

Click a notification to bring Harness to the foreground and open its conversation. Viewing that conversation while Harness is in front clears its notification. Returning to Harness without viewing the conversation does not clear it. A newer notification replaces an older one for the same session.

## Limits

- System taskbar and Dock badges are not supported.
- The Desktop client must remain running and connected. Notifications missed while disconnected are not recovered, and unread notifications do not survive a restart.
- Notifications are unavailable in the Web client. Notification permission, sound, delivery, and window activation depend on system settings. Installing the plugin does not override Do Not Disturb or a system notification denial.
- Starting or re-enabling the plugin, or reconnecting Harness, does not replay past task results or existing requests for input. Only new events trigger notifications.
- A task that finishes before the plugin starts observing it may be missed.
- Closing a notification does not approve or answer anything. Use the conversation's native controls.
