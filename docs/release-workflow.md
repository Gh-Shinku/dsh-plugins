# Release workflow

Publishable plugins under `packages/*` use independent Changesets versions. The root package is private and is neither versioned nor tagged.

## Development

- Add a changeset with `pnpm changeset` when changing published plugin behavior. Repository-only documentation, tests, and tooling may omit one.
- Inspect pending releases with `pnpm changeset:status`.
- Keep version changes in the generated version PR. `pnpm version-packages` updates manifests, changelogs, and the lockfile and consumes pending changesets; validate it in a disposable fixture rather than the working checkout.
- Run `pnpm check` and `pnpm pack:check` before delivery. Inspect packed README content, runtime entrypoints, and declared Harness compatibility when changing package contents.
- Do not enable publication, dispatch release workflows, publish packages, or create tags or releases without explicit authorization.

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
