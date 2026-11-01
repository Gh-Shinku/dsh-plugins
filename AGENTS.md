# Repository guidelines

- Keep independently installable plugins in `packages/*` and shared development tooling at the root.
- Keep root and package README files concise entry points. Put plugin introductions, installation instructions, usage details, and implementation notes in `docs/`.
- Use native Harness services and public exports; never modify dependencies or the sibling Harness checkout.
- Target the Harness version declared in package manifests and verify the packed runtime against it.
- Keep host code out of browser imports and keep session policy enforcement on the host.
- Persist profile templates through native settings and session snapshots through validated plugin records.
- Dispose session policies, UI registrations, timers, and subscriptions with their owners.
- Run `pnpm check` and `pnpm pack:check` before claiming completion.
- Do not publish packages or change the user's live Harness profile without explicit authorization.

## Git Delivery

For implementation, fixes, or configuration changes, complete Git delivery as part of the task.

- Workflow level: Simple. Make atomic commits by logical work unit, using concise Conventional Commit messages.
- Inspect staged changes and run `pnpm check` and `pnpm pack:check` before committing.
- Preserve unrelated changes and limit commits to the authorized scope. Keep credentials, local environment files, and generated artifacts out of commits.
- Work and commit on `main`; synchronize with `origin` before editing. Use a task branch or PR only when requested or repository rules require it.
- At delivery, push task commits to `origin/main`, satisfy required checks, and report commit and push status or any blocker.
- Respect branch protection and review requirements. Fix failures caused by the task; report blockers that require user action or external changes.
- Obtain explicit authorization for force-pushes, shared-history rewrites, repository deletion, releases, tags, and deployment.
