# @seshuk/payload-plugin-tooling

Shared dev config for `@seshuk` Payload 4 plugins: storage-bunny, media-preview, openapi, janitor. Dev dependency only. Never a runtime import of a plugin.

## Environment

- pnpm 12. Node.js 24.15+. Payload 4.

## Commands

```bash
pnpm typecheck
pnpm lint
pnpm format        # format:check to verify
pnpm test:unit
pnpm test:int    # tests/*.int.spec.ts: they start databases
pnpm build         # tsdown -> dist/
```

Before every commit: `pnpm typecheck && pnpm lint && pnpm format && pnpm test:unit && pnpm test:int`.

## Structure

- `src/oxlint.ts`, `src/oxfmt.ts`: base configs. Plugins spread and extend.
- `src/tsdown.ts`: `pluginBuild()`, plugin build config.
- `src/fields.ts`: `insertField()`, `findFieldPaths()`, `InsertPosition`. Bundled into plugin `dist/_tooling/` like telemetry. Type-only `payload` imports: Payload 3 and 4.
- `src/vitest.ts`: `vitestBase`, maps `@/` to `src/`.
- `src/testDatabase.ts`: in-memory test DB by `TEST_DB`. Adapters are optional peers, imported only when picked.
- `src/telemetry.ts`: `reportTelemetry()`, opt-out usage telemetry. `pluginBuild()` bundles it into plugin `dist/_tooling/` (`deps.onlyBundle`: this package only). New product slug: add on server first.
- `tsconfig.base.json`, `cliff.toml`: shared as files. `cliff.toml` has no repo: git-cliff reads `GITHUB_REPO` (`owner/repo`). Plugin with own release workflow keeps byte-identical copy and sets `GITHUB_REPO`.
- `.github/workflows/ci.yml`, `release.yml`: run here; plugins call them via `workflow_call`.
- `.zed/`, `.vscode/`: editor settings. Plugins keep identical copies. Change here first, then copy to each plugin.
- `.claude/settings.json`: base Claude Code settings. Plugins copy it and add own entries (MCP servers, plugins).
- `.claude-plugin/marketplace.json`, `claude/`: Claude Code marketplace `seshuk` with plugin `payload-plugin`: format hook (`hooks/format.sh`), release skill (`skills/release/SKILL.md`). Validate: `claude plugin validate .`.

## Rules

- Change here reaches every plugin. Plugin-specific settings stay in plugin.
- Breaking change to export or workflow input: new minor on 0.x, new major after 1.0.
- Plugins pin workflows by tag (`@vX.Y.Z`). Never move tags.
- Telemetry features: booleans only, never names or values.
- No code comments. Only JSDoc on plugin options types.
- One-line Conventional Commit. No co-authored-by or copyright trailers.
- Commit locally. Push only when asked.
