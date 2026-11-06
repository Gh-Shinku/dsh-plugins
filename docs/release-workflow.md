# Release workflow

Release Please maintains one combined version PR for the independently versioned plugins under `packages/*`. The private root is not a release component. Ordinary PRs record release intent through Conventional Commits; there are no changeset files or automatic version commits to main.

## Ordinary delivery

Use `fix` for a patch, `feat` for a feature, and `!` or a `BREAKING CHANGE` footer for breaking changes. Under the configured pre-1.0 policy, features and breaking changes bump minor; fixes bump patch. After 1.0, breaking changes bump major. Prefer squash-merging an ordinary PR with a final user-facing Conventional Commit title. Review all commits if preserving a multi-commit merge instead.

Only configured package paths contribute to their releases. Shared tooling, CI, and root documentation normally do not cause a package release. If a root change changes shipped behavior, include the corresponding package change and release intent. A commit touching both plugins can contribute to both release notes; scope text alone does not select a package. Keep unrelated work in separate PRs.

Do not commit until authorized. Follow the validation guidance in [AGENTS.md](../AGENTS.md): run checks relevant to the changes and reuse successful results while the covered code, dependencies, and configuration remain unchanged. For runtime acceptance, obtain authorization, have the user fully quit Desktop, and run `pnpm cd:local`; ask the user to reopen Desktop and test both plugins. See [local CD](./local-cd.md). Tooling-only changes can use `pnpm cd:local --prepare` to verify archives without changing the live profile. Report source revision, uncommitted status, receipt, artifacts, and limitations.

Acceptance of an ordinary delivery authorizes only the agreed ordinary PR work. It does not authorize merging the version PR or publishing packages. After required checks and reviews, ordinary PRs may merge while npm publication remains disabled.

## Version PR and release approval

`release-please-config.json` defines the two components and their tag prefixes; `.release-please-manifest.json` tracks versions. On main pushes, `.github/workflows/publish.yml` first runs Windows/Linux checks, then Release Please creates or updates the combined version PR. Preparation runs even when `NPM_PUBLISH_ENABLED` is unset. Package versions and changelogs are changed on the version PR branch until that PR is merged. Release Please does not automatically maintain pnpm's lockfile; run `pnpm install --frozen-lockfile` on the version PR, and update its lockfile explicitly if needed. These packages currently have no workspace dependencies on each other.

Before merging a version PR, show the user its exact head SHA, package/version plan, changelog, and validation results. Obtain separate explicit release authorization. Never auto-merge it because an ordinary task was accepted. Keep the npm switch off until the npm Trusted Publisher bindings and this release have been approved. Enabling it persists across future main pushes; the separate version-PR approval gate applies to every release.

## Publication and matching GitHub releases

Only an approved merged version PR may produce matching component tags such as `dsh-mcp-manager-v0.1.0`. With publication enabled, Release Please creates draft GitHub releases and tags. Its write-capable job lists drafts and selects only releases tagged at the workflow's exact SHA; ordinary main commits without matching tags select nothing. The pack job receives this plan as an artifact and needs only read permissions. Manual dispatch at a later SHA is not a recovery mechanism for an older release.

The pack job builds at the selected SHA and runs `pnpm pack:check`. It uploads the verified tarballs and release plan as an artifact. The publish job downloads those exact files, validates package versions and tag SHAs again, and publishes only the selected archives using pnpm's native OIDC publisher. Existing npm versions are checked against the archive's SHA-512 integrity before any writes. For new versions, a successful publish command is sufficient: there is no immediate post-publish registry lookup, because registry reads may lag behind publication. Once all selected packages are already present with matching integrity or their publish commands succeed, the job exposes the corresponding GitHub releases. npm version, GitHub tag, and source SHA stay aligned. npm and GitHub are separate services, so publication cannot be atomic across both.

The release job keeps `publish.yml` as the npm Trusted Publisher workflow identity, uses GitHub-hosted runners, and grants `id-token: write` only to the publish job. Registry and provenance are passed as `PNPM_CONFIG_*`. No static npm token is used. npm package ownership and Trusted Publisher bindings must already be configured; local checks do not prove live authentication.

`PAT_TOKEN` is an optional GitHub token for Release Please, not npm. Prefer a suitably scoped bot token so its version PR triggers CI. Falling back to `GITHUB_TOKEN` can prevent automatic PR checks; explicitly dispatch Check on the release branch, inspect checks at its exact head, and never bypass protection. Repository settings must permit Actions to create PRs. Introducing a GitHub environment or renaming the workflow requires reviewing npm's external bindings.

## Validation and recovery

`pnpm release:check` runs offline tests of the real Release Please strategy, component routing, version/changelog updates, workflow structure, and release selection/integrity guards. It runs inside `pnpm check`. Never validate by dispatching an enabled live release.

`pnpm release:preview` reads committed local history from the migration boundary and writes a proposed package/version plan, changelog entries, and package manifest updates to `.artifacts/release-preview/plan.json`. It makes no GitHub or npm writes and does not change source files. It is an offline strategy preview, not a substitute for reviewing the actual bot PR, which uses GitHub history and the latest release boundaries.

After a failure, keep the original run and artifact. Rerun failed jobs at the original SHA so the publish job reuses the original archives. Existing npm versions are skipped only when their integrity exactly matches those archives. Mismatched contents fail; never overwrite a published version or silently advance its number. If all jobs are rerun and the rebuilt archive differs, use the original artifact or obtain approval for a corrective release. GitHub drafts remain private until all selected packages are already present with matching integrity or their publish commands succeed. If exposing a GitHub release fails, the npm versions may already exist; rerunning the failed publish job finishes the missing step without republishing matching versions. If a recovery run starts before a previously published version is visible, wait for registry propagation before retrying. Recovery with external writes still requires authorization.

References: [Release Please](https://github.com/googleapis/release-please), [manifest configuration](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md), [Action credentials](https://github.com/googleapis/release-please-action#other-actions-on-release-please-prs), [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).
