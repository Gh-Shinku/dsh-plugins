# dsh-mcp-manager

Reusable MCP profiles and per-session server selection for DeepSeek Harness **0.2.1-rc.5**, with English and Chinese native Web/Desktop UI.

## Use

1. Open **Settings → MCP profiles**.
2. Create a profile, select its servers, and optionally mark it as the default for new sessions. Save your changes.
3. Start a new chat. Type `/` at the beginning of a line and choose **MCP**, type `/mcp`, or open **+ → MCP**. Choose **None**, a saved profile, or **Customize…** to adjust server membership in a native dialog.
4. Use the compact MCP indicator beside the composer to see the profile, **Modified** state, and readiness summary. Click it to inspect the selected MCPs and their status without configuration checkboxes.
5. In the inspector, use **Switch Profile** for direct selection, or **Customize…** to edit a detached session draft. **Apply** saves the draft; **Cancel** or Escape discards it. **Reset to profile** changes only the draft until applied.

Profiles and MCP membership can be changed during a conversation, including while the agent is running. Selecting a profile applies a session copy and never edits the template. A saved profile is marked as selected only while its server membership matches the session snapshot; customized snapshots mark **Customize…** instead. **None** is the default before you create a default profile. Forks and subagents inherit their originating selection. Resume restores the latest saved snapshot. Started chats predating the plugin retain inherited access until you explicitly apply a profile or customization.

Expand a server to browse its tools and expand a tool to inspect its description and parameter schema. Search covers server names, tool names, and descriptions.

The inspector shows only the selected servers (or inherited catalog for legacy sessions), with **Ready**, **Disconnected**, or explicit **Error** labels from the existing native catalog. Missing servers remain visible as disconnected. Catalog read failures show **Status unavailable**, rather than retaining a stale healthy label. Status refreshes every 15 seconds while the composer is visible and on window focus; the inspector also has **Refresh**. This does not connect to or probe MCP servers.

The native command picker remains focused on profiles and their concise server summaries. It handles keyboard navigation, cancellation, guarded command-token consumption, and composer focus. Customization opens after that picker closes. The indicator opens the inspector; it does not edit configuration. All surfaces use native controls, theme colors, and the MCP connector logo.

## Local installation

Build and pack from the monorepo root:

```sh
pnpm install
pnpm build
pnpm --filter @shinku-ever/dsh-mcp-manager pack --pack-destination ../../.artifacts
```

Using the CLI bundled with your installed Desktop application, install the tarball into the desired profile:

```sh
dsh plugin --profile desktop add /absolute/path/to/shinku-ever-dsh-mcp-manager-0.0.1.tgz
```

Select the installed bundle in Harness's Plugins UI and restart if requested. Use `web` instead of `desktop` for a standalone Web deployment. The package has not been published to npm.

## Configuration and ownership

Existing native `@deepseek-ai/dsh-mcp-client` entries form the catalog. Add or edit those definitions through Harness configuration. This plugin does not own connections, install MCP servers, or alter their global enablement. Selecting a server grants its tools to a session; globally disabled or unavailable servers remain unavailable.

Templates persist in the manager entry's `templates` setting through Harness's native profile configuration writer. The supplied bundle uses the stable entry id `shinku-mcp-manager`. Saves use native revisions to reject stale writes. Session snapshots use the versioned record `plugin:shinku/mcp-manager/selection` and survive the normal session log's fork/resume path.

The host filters tool declarations, PTC declarations, server instructions, and resource access, and checks tool calls with a final execution guard. Changes refresh subsequent prompt assembly and tool admissions; the manager does not cancel a tool call already executing. Other tool restrictions still apply. New MCP servers do not join existing snapshots automatically; newly discovered tools of a selected server follow that server's selection.

Server credentials, arguments, headers, and endpoint URLs are excluded from the catalog. Schemas and descriptions are rendered as text. Browsing never executes tools.

## Limits

Selection is server-level and can be adjusted throughout a conversation. There are no per-tool switches or server-configuration editors. Tool metadata is live and is not persisted for disconnected servers. Missing server identities remain visible in saved profiles and grant no access. Ambiguous native namespaces are denied. Readiness reflects the existing catalog metadata, rather than an independent connection-health check.

The manager is an access-selection plugin, not an MCP process isolation mechanism. MCP processes and upstream state remain shared. Uninstalling or disabling the manager removes its enforcement; session records are intentionally ignorable by Harness without the plugin.

Harness 0.2.2-rc.1 owns native tool declarations in the active executor. Native restrictions hide unselected inherited MCP tools. Tools registered directly on an agent remain visible in native declarations, but the manager's final host guard denies calls to unselected servers. PTC SDK text also excludes these unselected scoped tools. The manager uses the public PTC executor SDK renderers and leaves executor selection to Harness.

## Development

`pnpm dev -- --fixtures` starts an isolated Harness profile under `.artifacts/dsh-home` with synthetic MCP servers. It requires `dsh` on PATH and does not install into the normal Desktop profile. Build again before restarting it after source changes.

The host entry exports a Cordis service; the browser entry is a native module-loader factory. A single public `commandUi` contribution feeds both native command entry points. Shared Modal, Menu, Button, Input, and Checkbox components resolve from Harness's browser module table; feature layout uses `--dsw-*` tokens. Session-bound controllers share confirmed selection across the picker, indicator, and inspector, while customization holds a separate draft. Reads, writes, surfaces, and visible polling have separate lifetimes so stale reads cannot discard writes or drafts. Timers and pending openings stop on session replacement and plugin disposal. The existing record version and six Remote methods are unchanged; the compatibility `locked` field now stays false. Public Remote payloads are available through `./types`. Root tooling generates reflection and codecs from decorated method signatures. A build-only mirror supplies published protocol declarations to the pre-release source-oriented Typert analyzer; it never edits installed dependencies or the Harness repository.

Run `pnpm check` and `pnpm pack:check` from the repository root. Synthetic stdio servers exercise actual Harness discovery, agent scopes, prompt assembly, and execution without provider credentials.

UI tests render the real published Harness primitives and exercise its native command runtime in a headless DOM. Root development dependencies include the primitives' build-time helper packages because the prerelease publishes these as development dependencies. They are not bundled into the plugin. Visual and interactive acceptance testing is manual.
