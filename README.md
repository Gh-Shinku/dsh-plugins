# DSH plugins

A monorepo of independently installable DeepSeek Harness plugins under the `@shinku-ever` namespace.

Plugin introductions, installation instructions, and usage guides live in [docs](./docs/).

- [MCP manager](./docs/dsh-mcp-manager.md)
- [Desktop notifications](./docs/dsh-desktop-notifications.md)

## Development

Use Node 24.9 or later and pnpm 11.6.0.

```sh
pnpm install
pnpm build
pnpm check
pnpm pack:check
```

Root commands provide formatting, linting, typechecking, tests, builds, and package verification. CI runs the checks on Windows and Linux. `pnpm changeset` records independently versioned package changes; npm publication is manual.

## Layout

- `packages/`: publishable plugin source, tests, and metadata.
- `docs/`: plugin introductions, installation instructions, and usage guides.
- `scripts/`: shared development and verification tools.
- `.artifacts/`: ignored development data and build artifacts.

## Git delivery

Use the Simple workflow: commit directly to `main`, run the required checks, and push to `origin/main`. See [AGENTS.md](./AGENTS.md) for the project agreement.
