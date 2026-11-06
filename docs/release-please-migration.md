# Release Please migration notes

The following seven legacy Changesets records are preserved as historical release intent, not active inputs. Both npm packages already have version 0.0.1. The user selected 0.0.2 for the first Release Please release. The bootstrap boundary is the initial 0.0.1 preparation commit, fdb8649b041a74e2d498c7ddae1f3998ec0ef3dd, so original feature commits are not counted again. Subsequent compatibility fixes produce the 0.0.2 proposal. The old minor-bump records below do not determine the new release plan.

## automatic-desktop-notifications.md

---
"@shinku-ever/dsh-desktop-notifications": patch
---

Enable desktop notifications on plugin activation and remove the settings page, toggle, and test button.


## desktop-notification-delivery.md

---
"@shinku-ever/dsh-desktop-notifications": patch
---

Observe opened sessions before catalog running state catches up, avoid system notification tags, and restore Harness through its activation protocol when a notification is clicked.


## desktop-notifications.md

---
"@shinku-ever/dsh-desktop-notifications": minor
---

Add desktop background notifications for task completion, failures, and pending user interactions, with native profile settings and conversation navigation.


## first-mcp-manager.md

---
"@shinku-ever/dsh-mcp-manager": minor
---

Add native MCP profiles, per-session selection, and hierarchical tool browsing.


## latest-dsh-compatibility.md

---
"@shinku-ever/dsh-mcp-manager": patch
"@shinku-ever/dsh-desktop-notifications": patch
---

Target DeepSeek Harness 0.2.2-rc.1 and its Cordis 4.1 and Schemastery 3.19 dependencies. Adapt MCP prompt filtering to executor-owned tool declarations and the public PTC executor SDK renderers while retaining host execution guards.


## native-mcp-command.md

---
"@shinku-ever/dsh-mcp-manager": patch
---

Integrate MCP profile selection into the native slash and Add command menus, using concise server summaries and the MCP connector icon. Use shared DSH controls and design tokens in settings and guard asynchronous UI work across session replacement and plugin disposal.

Remove introductory helper paragraphs from profile settings and session customization.

Separate the profile picker, compact composer status indicator, read-only session inspector, and session customizer. Stage customization until Apply, discard it on Cancel, and preserve template and session isolation. Refresh visible status without overwriting drafts or confirmed writes.

Remove first-turn locking so profile selection and customization work throughout a conversation, including while the agent is running. Preserve inherited legacy access until an explicit configuration is applied. Keep the existing persistence format and host enforcement.


## npm-user-scope.md

---
"@shinku-ever/dsh-mcp-manager": patch
---

Rename the package to the publisher's npm scope, `@shinku-ever/dsh-mcp-manager`, and update browser module metadata, bundle references, self imports, build tooling, and installation documentation. Preserve the session record key, native settings entry id, and internal service identifiers.
