# @seshuk/payload-plugin-tooling

Shared dev config for the `@seshuk` Payload plugins: lint, format, TypeScript, build, test database, telemetry, field placement, changelog and GitHub workflows. Install it as a dev dependency only. Plugins never import it at runtime: the build bundles the telemetry and fields modules into the plugin.

```bash
pnpm add -D @seshuk/payload-plugin-tooling
```

## oxlint

```ts
// oxlint.config.ts
import { oxlintBase } from '@seshuk/payload-plugin-tooling/oxlint'
import { defineConfig } from 'oxlint'

export default defineConfig({
  ...oxlintBase,
  overrides: [...oxlintBase.overrides /* plugin rules */],
})
```

## oxfmt

```ts
// oxfmt.config.ts
import { oxfmtBase } from '@seshuk/payload-plugin-tooling/oxfmt'
import { defineConfig } from 'oxfmt'

export default defineConfig(oxfmtBase)
```

## TypeScript

```jsonc
// tsconfig.json
{
  "extends": "@seshuk/payload-plugin-tooling/tsconfig.json",
  "compilerOptions": { "rootDir": "./", "paths": { "@/*": ["./src/*"] } },
  "include": ["./src/**/*.ts", "./src/**/*.tsx", "./tests/**/*.ts"],
}
```

The build reads `tsconfig.build.json`, which extends `tsconfig.json` and sets `rootDir: ./src`, `outDir: ./dist` and `jsx: react-jsx`.

## tsdown

```ts
// tsdown.config.ts
import { pluginBuild } from '@seshuk/payload-plugin-tooling/tsdown'
import { defineConfig } from 'tsdown'

export default defineConfig(pluginBuild())
```

The build keeps the `src` file layout in `dist`, copies `src/**/*.css` and never bundles npm packages, except this package (see [Telemetry](#telemetry) and [Fields](#fields)). Pass `copy` for more files, for example `pluginBuild({ copy: ['src/**/*.edge.js'] })`.

## Vitest

```ts
// tests/vitest.config.ts
import { vitestBase } from '@seshuk/payload-plugin-tooling/vitest'
import { defineConfig } from 'vitest/config'

export default defineConfig({ ...vitestBase, test: { include: ['tests/**/*.spec.ts'] } })
```

`vitestBase` maps the `@/` alias to `src/`, the same as `paths` in `tsconfig.json`. Run Vitest from the plugin root.

## Test database

```ts
import { testDatabase } from '@seshuk/payload-plugin-tooling/test-database'

export default buildConfig({ db: await testDatabase() /* … */ })
```

`TEST_DB` picks an in-memory database: `sqlite` (default), `postgres` (PGlite) or `mongodb` (mongodb-memory-server). Install only the packages for the databases you test:

| `TEST_DB`  | Packages                                                                         |
| ---------- | -------------------------------------------------------------------------------- |
| `sqlite`   | `@payloadcms/db-sqlite`                                                          |
| `postgres` | `@payloadcms/db-postgres`, `@electric-sql/pglite`, `@electric-sql/pglite-socket` |
| `mongodb`  | `@payloadcms/db-mongodb`, `mongodb-memory-server`                                |

## Telemetry

Anonymous usage telemetry, shared by all plugins. Once a day per project, it sends the plugin, Payload and Node versions, the OS, a hashed project ID and the features the plugin passes. It never sends secrets, IPs, keys or names. On the first run, it logs a notice with the opt-outs.

Telemetry is off when any of these is set:

- `telemetry: false` in the Payload config or in the plugin options;
- `DO_NOT_TRACK=1` or the plugin's own variable, for example `BUNNY_TELEMETRY_DISABLED=1`;
- `CI` or `NODE_ENV=test`.

Call `reportTelemetry` in `onInit` and do not wait for it. It never throws. Features are booleans only, never names or values:

```ts
import { reportTelemetry, type TelemetryOption } from '@seshuk/payload-plugin-tooling/telemetry'

export type MyPluginConfig = { telemetry?: TelemetryOption /* … */ }

config.onInit = async (payload) => {
  await existingOnInit?.(payload)
  void reportTelemetry({
    disableEnv: 'BUNNY_TELEMETRY_DISABLED',
    docsUrl: 'https://payload-storage-bunny.seshuk.im/v4/configuration/telemetry',
    features: { signedUrls: Boolean(pluginConfig.signedUrls) },
    option: pluginConfig.telemetry,
    packageName: '@seshuk/payload-storage-bunny',
    payload,
    product: 'payload-storage-bunny',
  })
}
```

`pluginBuild()` bundles this module into the plugin's `dist/_tooling/`, so it is never a runtime dependency. Any other npm package that ends up in the bundle fails the build. `telemetry: { url }` sends to another collector. The server accepts only known products: add a new product slug on the server first.

## Fields

```ts
import { findFieldPaths, insertField, type InsertPosition } from '@seshuk/payload-plugin-tooling/fields'

collection.fields = insertField(collection.fields, { after: 'meta.title' }, myField)
const paths = findFieldPaths(collection.fields, (field) => Boolean(field.custom?.myPlugin))
```

`insertField(fields, position, field)` returns a new field list. `position` is an `InsertPosition`: `'first'`, `'last'`, `'sidebar'` (appends the field with `admin.position: 'sidebar'`), `{ after: path }` or `{ before: path }`. A path names fields by dots through groups, arrays and named tabs; rows, collapsibles, unnamed groups and unnamed tabs add no segment. A path that does not match from the top is also looked up inside every group and tab, so `{ after: 'title' }` finds `meta.title`. When that finds the name in more than one place, it throws `Field path "<path>" is ambiguous, use the full path: a.x, b.x`. An unknown path throws `Field path "<path>" not found`.

`findFieldPaths(fields, predicate)` returns the paths of the named fields that match, with the same naming rules, for example `['slug', 'meta.description', 'seo.image']`.

Both only import types from `payload` and work with Payload 3 and 4. `pluginBuild()` bundles the module into the plugin's `dist/_tooling/`.

## GitHub workflows

Both workflows run the scripts `lint`, `format:check`, `typecheck`, `test:unit`, `test:int` and `build`. Every plugin must define them. `test:unit` runs tests without a database or network; `test:int` runs the database tests.

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  ci:
    uses: maximseshuk/payload-plugin-tooling/.github/workflows/ci.yml@v0.2.1
    with:
      node-versions: '["24"]'
```

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*.*.*']
permissions:
  contents: read
jobs:
  release:
    uses: maximseshuk/payload-plugin-tooling/.github/workflows/release.yml@v0.2.1
    permissions:
      contents: write
      id-token: write
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

The release workflow:

- builds the changelog with git-cliff from the plugin's `cliff.toml`, or from the shared one in this package when the plugin has none, and takes the repository for links from `GITHUB_REPO`;
- puts `.github/releases/vX.Y.Z.md` under the version heading and above the commit list when the file exists;
- sets the npm dist-tag: `beta` for `X.Y.Z-beta.N`, `latest` for the newest major, `latest-N` for an older major;
- publishes with npm trusted publishing (OIDC), or with the `NPM_TOKEN` secret for the first release of a new package.

### Release notes

To add text under the version heading and above the commit list, such as a short intro or breaking changes, commit `.github/releases/vX.Y.Z.md` with the release. Keep it to a few lines and link to the upgrade guide in the docs for the details.

```markdown
<!-- .github/releases/v4.0.0.md -->

Payload 4 support. Upgrade guide: https://example.com/v4/upgrade-guide

## ⚠️ Breaking changes

- Node.js 24.15+ is required.
```

The file is optional, except for a new major (`vX.0.0`) and its first prerelease (`vX.0.0-beta.1`). Without it, those releases fail before anything is published.

### npm trusted publishing

npm can add a trusted publisher only to a package that already exists. For a new package:

1. Add an npm granular access token with publish rights as the `NPM_TOKEN` repository secret.
2. Push the first release tag. The workflow publishes with the token.
3. On npmjs.com, add a trusted publisher to the package: the plugin repository and the workflow file `release.yml` (the caller, not the file in this repository).
4. Delete the `NPM_TOKEN` secret and revoke the token. Later releases use OIDC.

## Editor settings

`.zed/settings.json` and `.vscode/` in this repository are the reference editor settings. Copy them to each plugin: editors cannot read settings from a package. They format with oxfmt on save, fix oxlint issues and use the TypeScript 7 language server.

- Zed: install the extensions `Oxc` and `TypeScript Language Server`.
- VS Code: install the recommended extensions from `.vscode/extensions.json`.

## Claude Code settings

`.claude/settings.json` is the reference project settings for Claude Code. Copy it to each plugin and add the plugin's own entries, such as MCP servers. It:

- allows read-only git and GitHub commands and the package scripts without a prompt;
- always asks before a push, a tag, a pull request, a release, a publish or a `gh api` call, also in auto mode;
- blocks reading `.env` files;
- turns off co-author lines in commits and pull requests;
- enables the official `payload` plugin and the `payload-plugin` plugin from this repository.

### The `payload-plugin` plugin

This repository is also a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`). The plugin in `claude/` has:

- a hook that runs `oxlint --fix` and `oxfmt` on every file Claude edits, and shows the remaining lint errors to Claude. It needs `jq`;
- the `/payload-plugin:release` skill, which prepares a release: version, release notes, checks, release commit and tag. It never pushes.

Plugins get changes to the hook and the skill without copying files.

## License

MIT
