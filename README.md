# DSH plugins

A monorepo of independently installable DeepSeek Harness plugins under the `@shinku-ever` namespace.

Choose a plugin for installation instructions and usage:

- [MCP manager](./packages/dsh-mcp-manager/)
- [Desktop notifications](./packages/dsh-desktop-notifications/)

## Development

```sh
pnpm install
pnpm build
pnpm check
pnpm pack:check
```

Root commands provide formatting, linting, typechecking, tests, builds, and package verification. CI runs the checks on Windows and Linux. `pnpm changeset` records independently versioned package changes. See the [release workflow](./docs/release-workflow.md) for version PRs, npm Trusted Publishing, and enabling publication; release automation is disabled by default.

## Layout

- `packages/`: publishable plugin source, tests, and metadata.
- `docs/`: plugin introductions, installation instructions, and usage guides.
- `scripts/`: shared development and verification tools.
