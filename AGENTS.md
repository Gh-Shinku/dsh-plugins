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
- Without further human approval, agents may edit, validate, prepare an isolated local delivery, and make atomic Conventional Commits only on the new task branch. Preserve unrelated changes and exclude credentials, local environment files, and generated artifacts.
- Inspect staged changes before committing; run `pnpm check` and `pnpm pack:check` before committing or claiming completion.
- When implementation and checks are ready, launch the task's local delivery (local CD) in an isolated environment and explicitly ask the user to test and accept it. Provide the tested commit, local URL or artifact paths, test steps, and limitations. See `docs/release-workflow.md`.
- Stop at the local acceptance handoff. Passing automated checks, elapsed time, silence, or an earlier task's approval is not acceptance. Do not push, open a PR, merge, or trigger GitHub CD before the user explicitly confirms this task's delivery.
- After explicit acceptance, push the accepted task branch, open a PR to `main`, and merge all commits for the accepted task only after required checks and reviews pass, respecting branch protection. Acceptance authorizes this delivery's GitHub CD publication to npm, including its scoped version PR, package tags, and releases. Show the release package/version plan before acceptance; do not include unrelated pending changesets or unreviewed release content.
- Material changes after acceptance require renewed local testing and acceptance. Do not bypass checks, reviews, protection, or release gates. Report publication as successful only after verifying the GitHub run and npm versions.
- Report the PR, commit, merge status, and blockers; fix failures caused by the task.
- Add a changeset for published plugin behavior changes; repository-only documentation, tests, and tooling may omit one.
- Keep `NPM_PUBLISH_ENABLED` disabled until the user explicitly accepts a concrete npm release plan and authorizes enabling GitHub CD. Do not publish from the local machine. Force-pushes, shared-history rewrites, repository deletion, changes to the live Harness profile, and deployment outside the accepted delivery always require separate explicit authorization.
