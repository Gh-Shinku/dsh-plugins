# Local Desktop delivery

Requires the repository's Node.js and pnpm versions, plus `dsh` from the installed Desktop release on PATH. The CLI must match the plugins' declared Harness version. This delivers the current checkout, including uncommitted source changes; it does not fetch npm's latest plugin release.

Fully quit Harness Desktop, including its tray process, then run:

```sh
pnpm cd:local
```

The JavaScript script works on Windows, macOS, and Linux wherever Harness Desktop is supported. It runs `pnpm check` and `pnpm pack:check`, copies both verified archives into a unique `.artifacts/local-cd/` delivery directory, saves profile metadata for recovery, and installs the archives together using `dsh plugin --profile desktop add --ignore-scripts --save-exact`. It verifies installed file hashes, bundle enablement, and preservation of unrelated dependencies and bundles. The official CLI owns locking and compatibility checks.

Options:

- `pnpm cd:local --prepare`: validate and create archives without accessing or installing into the Desktop profile.
- `pnpm cd:local --dsh /path/to/dsh`: select the CLI bundled with Desktop when PATH points elsewhere.
- `pnpm cd:local --registry https://registry.npmmirror.com`: use a registry mirror for dependency downloads; existing private scope mappings remain in effect.
- `DSH_HOME`: respected by both profile resolution and the child CLI. By default the existing Desktop profile is used. A custom home must already have a Desktop-initialized profile.

Each delivery has a `delivery.json` containing archive paths, SHA-256 hashes, profile path, verification status, and backup location. Keep the delivery directory: the profile references its local archives, and the private backup may contain local configuration. It is gitignored. A failed install is reported as failed; it does not automatically restore metadata over a potentially changed dependency tree. Inspect the native CLI diagnostics and backup before recovery.

Reopen Desktop after success. Test both plugins:

1. Confirm MCP manager loads; select a server in a conversation, use its tool, and confirm another unselected server is blocked.
2. Change the selection and confirm it applies to subsequent calls and remains isolated from other conversations.
3. Start a task, switch away from Desktop, and confirm completion or a new interaction generates a notification. Click it to return to the conversation.
4. Repeat with Desktop in front and confirm no notification appears.

Installation is not evidence that the application has loaded the plugins. Complete these manual checks before accepting delivery. The script never commits, pushes, publishes, closes Desktop, or restarts it.
