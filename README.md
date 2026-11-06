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

Root commands provide formatting, linting, typechecking, tests, builds, and package verification. CI runs the checks on Windows and Linux. Release Please tracks Conventional Commits and prepares a version PR for independently versioned plugins. Ordinary PRs do not publish packages. See the [release workflow](./docs/release-workflow.md) for separate release approval and npm Trusted Publishing; npm publication is disabled by default.

## Layout

- `packages/`: publishable plugin source, tests, and metadata.
- `docs/`: plugin introductions, installation instructions, and usage guides.
- `scripts/`: shared development and verification tools.
