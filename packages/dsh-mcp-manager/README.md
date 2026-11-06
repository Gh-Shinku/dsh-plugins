# dsh-mcp-manager

[![npm](https://img.shields.io/npm/v/@shinku-ever/dsh-mcp-manager)](https://www.npmjs.com/package/@shinku-ever/dsh-mcp-manager) [![Harness plugin](https://img.shields.io/badge/Harness-plugin-blue)](https://github.com/Gh-Shinku/dsh-plugins/blob/main/docs/dsh-mcp-manager.md) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

Manage reusable MCP profiles and choose which servers each DeepSeek Harness conversation can access. Switch profiles, customize session selections, and browse server tools through the native Web and Desktop interfaces.

## Install

In Harness's plugin manager, install `@shinku-ever/dsh-mcp-manager` from npm into the Web or Desktop profile you use. Enable the installed bundle, then restart or reload Harness when requested.

## Quick start

1. Open **Settings → MCP profiles**, create a profile from your existing MCP servers, and save it.
2. In a conversation, enter `/mcp` or choose **+ → MCP**, then select the profile.
3. Click the MCP indicator beside the composer to inspect selected servers and their tools. Choose **Customize…** to adjust the session selection, then **Apply**.

Session changes do not edit the saved profile template. The plugin uses your existing Harness MCP configuration; it does not install or configure servers. See the [usage and configuration guide](https://github.com/Gh-Shinku/dsh-plugins/blob/main/docs/dsh-mcp-manager.md) for defaults, persistence, and access behavior.

## Usage notes

Supports the Web and Desktop interfaces in English and Chinese. Selection applies to whole servers. Disabling the plugin removes its session access enforcement; see [limitations](https://github.com/Gh-Shinku/dsh-plugins/blob/main/docs/dsh-mcp-manager.md#limits).

## License

[MIT](./LICENSE).
