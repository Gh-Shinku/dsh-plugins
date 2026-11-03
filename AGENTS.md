# Repository guidelines

- Keep independently installable plugins in `packages/*` and shared development tooling at the root.
- Keep root and package READMEs concise; put detailed guides and implementation notes in `docs/`.
- Use native Harness services and public exports; never modify dependencies or the sibling Harness checkout.
- Target the Harness version declared in package manifests and verify the packed runtime against it.
- Keep host code out of browser imports and keep session policy enforcement on the host.
- Persist profile templates through native settings and session snapshots through validated plugin records.
- Dispose session policies, UI registrations, timers, and subscriptions with their owners.
- Do not change the user's live Harness profile without explicit authorization.

## Git Delivery

- Start each new task on a fresh `<type>/` branch from the latest `origin/main`; never commit or push directly to `main`.
- Make atomic Conventional Commits within the authorized scope; preserve unrelated changes and exclude credentials, local environment files, and generated artifacts.
- Inspect staged changes before committing; run `pnpm check` and `pnpm pack:check` before committing or claiming completion.
- Push the task branch and open a PR to `main`; merge after required checks and reviews pass, respecting branch protection.
- Report the PR, commit, merge status, and blockers; fix failures caused by the task.
- Add a changeset for published plugin behavior changes; repository-only documentation, tests, and tooling may omit one.
- Obtain explicit authorization for npm publication, publication-triggering version PR merges, releases, tags, deployment, force-pushes, shared-history rewrites, and repository deletion.
