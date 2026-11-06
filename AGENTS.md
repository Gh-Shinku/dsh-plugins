# Repository guidelines

- Keep independently installable plugins in `packages/*` and shared development tooling at the root.
- Keep root and package READMEs concise; put detailed guides and implementation notes in `docs/`.
- Use native Harness services and public exports; never modify dependencies or the sibling Harness checkout.
- Target the Harness version declared in package manifests and verify the packed runtime against it.
- Keep host code out of browser imports and keep session policy enforcement on the host.

## Git Delivery

- Start each new task on a fresh `<type>/` branch from the latest `origin/main`; never commit or push directly to `main`.
- Without further human approval, agents may edit, validate, and prepare a local delivery on the new task branch. Do not commit until the user explicitly authorizes it. Preserve unrelated changes and exclude credentials, local environment files, and generated artifacts.
- Inspect staged changes before committing; run `pnpm check` and `pnpm pack:check` before committing or claiming completion.
- When implementation and checks are ready, run `pnpm cd:local` to install both current plugins into dsh Desktop, after the user has fully quit Desktop and authorized installation. Explicitly ask the user to reopen Desktop, test, and accept the delivery. Provide the source revision and uncommitted status, artifact paths, test steps, and limitations. See `docs/local-cd.md` and `docs/release-workflow.md`.
- Stop at the local acceptance handoff. Passing automated checks, elapsed time, silence, or an earlier task's approval is not acceptance. Do not push, open a PR, merge, or trigger GitHub CD before the user explicitly confirms this task's delivery.
- After explicit acceptance and commit authorization, push the task branch, open an ordinary PR to `main`, and merge only after required checks and reviews pass, respecting branch protection. Ordinary PR acceptance does not authorize a version PR merge, npm publication, tags, or GitHub releases. Obtain separate explicit approval of the release packages, versions, and source revision before merging a Release Please version PR or enabling publication.
- Report the PR, commit, merge status, and blockers; fix failures caused by the task.
- Use Conventional Commits for release intent (`fix`, `feat`, and `!` for breaking changes). Prefer squash-merging ordinary PRs with a title describing their final user impact. Release Please maintains one combined version PR with independent package versions; do not add changeset files. Keep repository tooling outside the published package paths unless it changes their runtime behavior. Follow `docs/release-workflow.md`.
