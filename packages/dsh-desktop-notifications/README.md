# dsh-desktop-notifications

[![npm](https://img.shields.io/npm/v/@shinku-ever/dsh-desktop-notifications)](https://www.npmjs.com/package/@shinku-ever/dsh-desktop-notifications) [![Harness plugin](https://img.shields.io/badge/Harness-plugin-blue)](https://github.com/Gh-Shinku/dsh-plugins/blob/main/docs/dsh-desktop-notifications.md) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Receive system notifications when DeepSeek Harness desktop is in the background and a task finishes, fails, or needs your input. Click a notification to return to its conversation. Notifications show only the session title and status.

## Install

In Harness desktop's plugin manager, install `@shinku-ever/dsh-desktop-notifications` from npm. Restart or reload the desktop client when requested. Notifications start automatically when the plugin activates.

## Quick start

1. Allow notifications if Harness requests permission when the plugin activates. No plugin settings or additional activation are required.
2. Start a task, then minimize Harness or switch to another application.
3. When the task finishes or needs input, click its notification to open the conversation.

Foreground events and manual cancellations do not produce notifications. Disable or uninstall the plugin through the native plugin manager to stop delivery. See the [usage guide](https://github.com/Gh-Shinku/dsh-plugins/blob/main/docs/dsh-desktop-notifications.md#use) for notification behavior.

## Compatibility

Targets DeepSeek Harness **0.2.1-rc.5** with Node.js **24.9.0 or later**. Requires the Desktop client to remain running and connected; the ordinary Web client is inactive. System notification permissions, Do Not Disturb, and window focus policies still apply. See [limitations](https://github.com/Gh-Shinku/dsh-plugins/blob/main/docs/dsh-desktop-notifications.md#limits).

## License

[MIT](./LICENSE).
