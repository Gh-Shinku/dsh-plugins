# Release workflow

Publishable plugins under `packages/*` use independent Changesets versions. The root package is private and is neither versioned nor tagged.

## Development

- Add a changeset with `pnpm changeset` when changing published plugin behavior. Repository-only documentation, tests, and tooling may omit one.
- Inspect pending releases with `pnpm changeset:status`.
- Keep version changes in the generated version PR. `pnpm version-packages` updates manifests, changelogs, and the lockfile and consumes pending changesets; validate it in a disposable fixture rather than the working checkout. Include the resulting package/version plan and any pre-existing pending changesets in the acceptance handoff.
- Run `pnpm check` and `pnpm pack:check` before delivery. Inspect packed README content, runtime entrypoints, and declared Harness compatibility when changing package contents.
- Until the user accepts this task's local delivery, agents may commit only on its new branch. Do not push, open a PR, merge, enable publication, dispatch release workflows, publish packages, or create tags or releases.

## Local delivery and human acceptance

After implementation, inspect the diff and prepare the local delivery on its new branch. Do not commit until explicitly authorized. `pnpm cd:local` runs `pnpm check` and `pnpm pack:check`, then installs both verified archives into the existing dsh Desktop profile. Generated artifacts stay uncommitted.

Obtain authorization to install into Desktop and have the user fully quit it, including the tray process, before running local CD. Use the CLI bundled with the installed Desktop release. The script records backups and verified artifact hashes under `.artifacts/local-cd/`; see [local CD](./local-cd.md). Ask the user to reopen Desktop for manual acceptance of both plugins. `pnpm dev -- --fixtures` remains an optional isolated MCP Web preview; it does not validate Desktop notifications. Documentation-only changes may deliver a local document preview.

Ask the user to test and explicitly accept the delivery. Provide the source revision and uncommitted status, archive paths, delivery receipt, checks run, manual test steps, and known limitations. For an npm delivery, also show which packages and versions GitHub CD will publish. Stop before commits or remote changes unless the user has authorized them. Silence and automated success never grant approval.

When the user explicitly accepts this delivery, push the accepted branch, open its PR, wait for required checks and reviews, and merge the task's commits into `main`. That acceptance also authorizes GitHub CD for the disclosed npm release plan, including merging its generated version PR after checking its contents and CI. If the generated version PR contains unrelated pending changesets, unexpected versions, or additional changes, obtain acceptance of the revised plan before merging it. Any material code changes after acceptance require a new local delivery and acceptance.

Keep `NPM_PUBLISH_ENABLED` disabled until acceptance of a concrete release plan explicitly authorizes enabling it. Use the GitHub workflow for publication, never a local `npm publish`. Enabling the variable is persistent: once enabled, later main pushes can publish, so every future task must follow this acceptance gate. Do not weaken CI, review requirements, branch protection, or the workflow's main-only restriction. Report the PR, task and merge commits, GitHub CD status, and verified npm versions; identify any blocker instead of claiming publication from a successful merge alone.

## Workflow architecture

`.github/workflows/publish.yml` handles main pushes and manual runs on main. It first calls reusable `check.yml`, which runs `pnpm check` and `pnpm pack:check` on Windows and Linux. Pull requests, other branch pushes, and manual check runs use `check.yml` directly.

Release jobs require the repository variable `NPM_PUBLISH_ENABLED` to equal `true`. Otherwise only CI runs. Preserve this gate and the main-branch restriction. An enabled run can publish unpublished manifest versions immediately when no pending changesets exist.

Pinned Changesets Action sub-actions select the next operation:

1. `version`: run `pnpm version-packages` and create or update the version PR.
2. `pack`: build unpublished versions on a fresh runner and upload prebuilt tarballs with their publish plan. Disable lifecycle scripts only during packing to avoid duplicate builds.
3. `publish`: download the packed artifact by ID, publish those exact tarballs, push package tags, and create GitHub releases. Do not rebuild, repack, or repeat CI in this job.
4. No pending changesets or unpublished versions: skip release work.

Serialize runs per Git ref without cancelling active releases. Keep checkout credentials unpersisted and job permissions limited to their responsibilities. The plugins currently have no runtime dependency on each other; reassess publication ordering if internal runtime dependencies are introduced.

## Authentication constraints

The native Changesets publisher detects the pnpm workspace and uses pnpm's OIDC-capable publisher. Preserve `id-token: write`, GitHub-hosted runners, the npm registry, and provenance in the publish job. Use `PNPM_CONFIG_*` settings for pnpm's native publisher. Keep static npm tokens and generated token-based authentication files out of this flow.

npm trusted publisher bindings refer to this repository's `publish.yml`. Renaming the workflow, changing the repository, introducing a GitHub environment, or moving publication into a reusable workflow requires reviewing the external bindings. Editing repository files does not update those bindings.

`PAT_TOKEN` is optional and used only for version PRs; npm authentication uses OIDC. Without it, versioning falls back to `GITHUB_TOKEN`, whose generated PRs do not automatically trigger CI. Do not assume a generated version PR has passing checks; inspect checks for its exact commit and respect branch requirements.

See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), [pnpm's GitHub OIDC implementation](https://github.com/pnpm/pnpm/blob/v11.6.0/releasing/commands/src/publish/oidc/idToken.ts), and the [Changesets Action](https://github.com/changesets/action/tree/ae32849d5ba541f9ae29e40e22a623bc13562f51) when changing authentication or artifact publication.

## Validation and recovery

Validate workflow syntax, inspect changeset status, and exercise versioning and packing in a disposable fixture. Never dispatch an enabled release workflow solely to validate configuration. Local validation does not prove live OIDC authentication or npm publication.

Publication is not atomic. After a failed run, inspect npm versions, logs, tags, and GitHub releases before proposing a retry. A new run computes a fresh unpublished-version plan but may not repair missing tags or GitHub releases for versions already on npm. Never reuse a published version for changed contents; prepare a corrective changeset. Recovery that publishes or modifies external release state still requires explicit authorization.
