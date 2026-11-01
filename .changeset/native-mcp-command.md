---
"@shinku-ever/dsh-mcp-manager": patch
---

Integrate MCP profile selection into the native slash and Add command menus, using concise server summaries and the MCP connector icon. Use shared DSH controls and design tokens in settings and guard asynchronous UI work across session replacement and plugin disposal.

Remove introductory helper paragraphs from profile settings and session customization.

Separate the profile picker, compact composer status indicator, read-only session inspector, and session customizer. Stage customization until Apply, discard it on Cancel, and preserve template and session isolation. Refresh visible status without overwriting drafts or confirmed writes.

Remove first-turn locking so profile selection and customization work throughout a conversation, including while the agent is running. Preserve inherited legacy access until an explicit configuration is applied. Keep the existing persistence format and host enforcement.
