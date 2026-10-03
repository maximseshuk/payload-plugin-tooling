# Contributing

Thanks for helping with the shared tooling for the @maximseshuk Payload plugins. This guide covers the setup, the rules the code follows, and how pull requests get reviewed.

## Before you start

- For a bug, open an issue with steps to reproduce first, unless the fix is small and obvious.
- For a new feature or a change to an export or a workflow input, open an issue first and describe the use case. A change here reaches every plugin, so it saves you work if the idea doesn't fit the tooling.
- For security problems, don't open an issue. Follow [SECURITY.md](SECURITY.md).

## Setup

You need Node.js 24.15+ and pnpm 12.

```bash
pnpm install
pnpm test:unit
```

## Test setup

Tests need no accounts and no `.env` file. This package has no dev app. `testDatabase()` reads `TEST_DB` (`sqlite` by default, `postgres` on in-memory PGlite, `mongodb` on an in-memory MongoDB server).

## Commands

```bash
pnpm typecheck      # tsc --noEmit
pnpm lint           # oxlint
pnpm format         # oxfmt
pnpm test:unit      # unit tests
pnpm build          # tsdown
```

Run `pnpm typecheck && pnpm lint && pnpm format && pnpm test:unit` before you push.

## Code rules

- **Keep it a dev dependency.** Plugins never import this package at runtime.
- **Keep plugin-specific settings in the plugin.** Only what every plugin shares belongs here. The base configs in `src/oxlint.ts` and `src/oxfmt.ts` are spread and extended by the plugins.
- **Treat exports and workflow inputs as public API.** A breaking change to either needs a new minor on 0.x, and a new major after 1.0. Plugins pin the workflows by tag, so never move a tag.
- **Import database adapters lazily.** Adapters are optional peers in `src/testDatabase.ts`. Load one only when `TEST_DB` picks it.
- **Copy shared editor files.** `.zed/`, `.vscode/` and `.claude/settings.json` are copied into each plugin. Change them here first, then copy them over.
- **Comment sparingly.** Name things so the code explains itself. Add a comment only for a workaround or a constraint a reader would miss.
- **Match the surrounding code.** Follow the naming and patterns already used in the file you change.
- **Ask before adding a dependency.** Say why in the issue or PR.

## Tests

- Add or update tests for every behavior change.
- Tests live in `tests/`.
- Name a `describe` after the function or feature under test (`testDatabase`, `pluginBuild`). Start an `it` name with a present-tense verb and write it in plain English: `throws when TEST_DB is unknown`, not `should throw…`.
- A bug fix should come with a test that fails without the fix.
- Don't commit `.only`, `.skip` or placeholder tests.

## Docs

If users will notice the change, update `README.md`. It is the only documentation for the package.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) with a short, one-line subject, for example `fix: copy CSS without flattening folders` or `feat: add a copy option to pluginBuild`. The release changelog is built from these.
- Keep each PR focused on one change. Open it against `main`. Only the latest 0.x minor is supported, so there are no older branches to port fixes to.
- Fill in the PR template: what changed, why, and how you tested it. Link the issue (`Closes #123`).
- CI must pass. The `Lint, typecheck, test, build (24)` check runs lint, format check, typecheck, unit tests and the build on Node 24.
- All review threads need to be resolved before merge.

## License

By contributing, you agree that your work is released under the [MIT License](LICENSE).
