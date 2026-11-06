# MCP manager

Reusable MCP profiles and per-conversation server selection for DeepSeek Harness, with English and Chinese Web and Desktop interfaces.

## Install

In Harness's plugin manager, install `@shinku-ever/dsh-mcp-manager` from npm into the Web or Desktop profile you use. You can also select a local `.tgz` plugin archive. Enable the installed bundle, then restart or reload Harness when requested.

Configure your MCP servers in Harness before creating a profile. This plugin selects existing servers; it does not install servers or change their configuration.

## Use

1. Open **Settings → MCP profiles**.
2. Create a profile, select its servers, and optionally mark it as the default for new conversations. Save your changes.
3. In a conversation, enter `/mcp` or choose **+ → MCP**. Choose **None**, a saved profile, or **Customize…** to select servers for this conversation.
4. Click the MCP indicator beside the composer to inspect selected servers and their tools. Use **Switch Profile** to select another profile, or **Customize…** to adjust the selection.
5. In **Customize…**, choose **Apply** to save your changes. **Cancel** or Escape discards them. **Reset to profile** resets the draft; choose **Apply** to use it.

You can change profiles and server selections while the agent is running. Changes apply to subsequent tool calls; a call already running continues. Other Harness tool restrictions still apply.

### Profiles and saved selections

Selecting a profile copies its server selection into the conversation. Changing that selection does not edit the saved profile. The MCP indicator shows **Modified** when the conversation's selection differs from the profile.

**None** is the default until you choose a default profile. Forks and subagents inherit their originating conversation's selection. Resuming a conversation restores its saved selection. Conversations started before the plugin was installed keep their existing access until you apply a profile or customization.

New servers do not join existing conversation selections automatically. New tools added to a selected server become available with that server. Globally disabled or unavailable servers remain unavailable even when selected.

### Inspect servers and tools

Expand a server to browse its tools, then expand a tool to read its description and parameters. Search covers server names, tool names, and descriptions. Browsing tools does not execute them. Server credentials, arguments, headers, and endpoint URLs are not shown.

The inspector shows selected servers with **Ready**, **Disconnected**, or **Error** labels. Missing servers remain visible as disconnected. If status cannot be read, it shows **Status unavailable**. Status refreshes while the composer is visible and when you return to the window; choose **Refresh** in the inspector to update it manually.

## Limits

- Selection applies to whole servers. There are no per-tool switches or server-configuration editors.
- Status reflects Harness's server catalog; it does not perform a separate connection check. Tool details may be unavailable for disconnected servers.
- Missing servers grant no access. Servers whose identities cannot be distinguished are blocked.
- MCP processes and their upstream state remain shared between conversations. Selecting servers does not create isolated server instances.
- Tools registered directly on an agent may still appear in its tool list, but calls to unselected servers are blocked.
- Disabling or uninstalling the plugin removes its conversation access enforcement.
