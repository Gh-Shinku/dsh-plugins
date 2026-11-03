# Release workflow

Both `@shinku-ever/dsh-mcp-manager` and `@shinku-ever/dsh-desktop-notifications` have independent public npm versions. The root package is private and is neither versioned nor tagged. Existing pending changesets are retained; setting up the workflow does not consume them or change package versions.

## Workflow

Pushes to `main` and manual runs on `main` start `.github/workflows/publish.yml`. Its first job calls the reusable `check.yml`: Windows and Linux must both pass `pnpm check` and `pnpm pack:check`. Pull requests, other branch pushes, and manual check runs use `check.yml` directly.

Release automation is disabled unless the repository variable `NPM_PUBLISH_ENABLED` equals the lowercase string `true`. With the variable unset or false, only CI runs: no version PR, npm publication, tags, or GitHub releases are created. Manual dispatch does not bypass the switch or the main-branch restriction.

Once enabled, pinned Changesets Action v2 sub-actions and CLI v3 select one path:

1. Pending changesets: `version` runs `pnpm version-packages`, updates versions and changelogs, consumes the changesets, refreshes the pnpm lockfile, and creates or updates `chore(release): version packages`.
2. After that PR merges, a new main push finds unpublished versions. `pack` builds them on a fresh runner, packs prebuilt output with lifecycle hooks disabled, and uploads the tarballs and publish plan.
3. `publish` downloads the exact artifact by ID through the native Changesets Action, publishes its tarballs with provenance, pushes package tags, and creates GitHub releases. It does not rebuild or repeat CI.
4. If neither pending changesets nor unpublished versions exist, no release work runs.

Runs are serialized per ref and do not cancel an in-progress release. Only the version job can write PRs; only the publish job has OIDC permission for provenance. Checkout credentials are not persisted. The two plugins have no runtime dependency on each other, so the native Changesets publisher is used without the reference repository's additional internal-dependency guard.

## npm token and GitHub settings

This workflow uses an npm granular access token. It can publish a new package as well as subsequent versions; this configuration does not require an initial local publication.

1. Sign in to npm as an account allowed to publish under `@shinku-ever`. Open the avatar menu, **Access Tokens → Generate New Token**.
2. Give the token a descriptive name and an expiry. Under **Packages and scopes**, grant **Read and write (publish and stage)**, or the equivalent publish-capable read/write permission. Limit it to these two packages when they already exist; for new packages, select the `@shinku-ever` scope so first publication is permitted. Organization administration access is not needed.
3. Enable **Bypass two-factor authentication** for unattended publication. A stage-only or read-only token cannot run this workflow. If an existing package disallows token publishing in its Publishing access settings, a granular token cannot override that setting. Do not restrict the token to your PC's IP: GitHub-hosted runners publish from other addresses.
4. Copy the token into GitHub repository **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Name it exactly `NPM_TOKEN`. Never put its value in a tracked file or in chat. `setup-node` creates runner-local npm configuration; only the credential check and publish step receive `NODE_AUTH_TOKEN` from that secret.
5. Under **Settings → Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve pull requests**. Jobs declare their own read/write permissions.
6. For automatically triggered CI on version PRs, create a fine-grained GitHub PAT limited to `Gh-Shinku/dsh-plugins`, with repository **Contents: Read and write** and **Pull requests: Read and write**, and store it as `PAT_TOKEN` in repository Actions secrets. It is a GitHub credential, separate from npm's token. If branch policies demand more permissions, follow those policies rather than bypassing protection.

Without `PAT_TOKEN`, versioning falls back to the built-in `GITHUB_TOKEN`. PRs created with it do not automatically trigger other workflows. In that case manually run **Check** on the generated version PR branch and verify the exact commit before merging; protected-branch requirements may still require a PAT or GitHub App that triggers PR checks.

Repository settings and secrets are not changed by committing these files. Official references: [npm token creation](https://docs.npmjs.com/creating-and-viewing-access-tokens/), [npm publishing authentication](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/), and [Changesets version action](https://github.com/changesets/action/tree/ae32849d5ba541f9ae29e40e22a623bc13562f51/version).

## Enable a release later

Keep `NPM_PUBLISH_ENABLED` absent or false while preparing credentials. Adding `NPM_TOKEN` alone does not enable releases.

When publication is explicitly approved, review `pnpm changeset:status`, then add an Actions **repository variable** named `NPM_PUBLISH_ENABLED` with value `true`. The next main push or manual **Version or publish packages** run on `main` starts release automation. Setting the variable alone does not start a run. If there are no pending changesets, a run can publish currently unpublished manifest versions immediately; enabling is not just a version-PR preview.

Review and merge the version PR when ready. You may accumulate several changesets before merging. Return the variable to `false` to prevent future release jobs; this does not stop a publish step already running.

## Daily changes and recovery

Run `pnpm changeset` for a change that affects published plugin behavior. Use `pnpm changeset:status` to inspect the plan. Keep versioning in the version PR; `pnpm version-packages` changes real manifests, changelogs, and the lockfile and should not be run on the working checkout merely to validate configuration.

Publication is not atomic. If one package succeeds and another fails, inspect npm versions, workflow logs, tags, and GitHub releases before retrying. A new run computes a fresh plan for unpublished versions. It may not repair missing GitHub releases or tags for versions already on npm. Never reuse a published version for changed contents; record a corrective release instead. Tags, releases, and live publication require explicit authorization.

The setup can be validated using local changeset status, a disposable version/pack fixture, and the normal checks. Do not dispatch an enabled release workflow merely to test configuration.
