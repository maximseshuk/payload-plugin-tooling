---
name: release
description: Prepare a release of a @seshuk Payload plugin. Bump version, write release notes, run the gate, make the release commit and tag.
argument-hint: '[version | patch | minor | major | beta]'
disable-model-invocation: true
---

# Release

Prepare release on current branch. Never push without explicit ask.

1. Check: clean tree, on release branch (`main` or old-major branch like `3.x`), in sync with `origin`. Previous tag: `git describe --tags --abbrev=0`.
2. Version: take from argument. No argument: propose from commits since previous tag (`fix` = patch, `feat` = minor, `!` or `BREAKING CHANGE` = major). Prerelease: `X.Y.Z-beta.N`. Confirm with user.
3. Bump `version` in `package.json`. Only version source.
4. Release notes `.github/releases/vX.Y.Z.md`. Required for `vX.0.0` and `vX.0.0-<pre>.1`, else optional. Few lines: intro, `## ⚠️ Breaking changes` list, link to upgrade guide. git-cliff adds commit list itself: never repeat it.
5. Plugin steps: follow `Releases` section of plugin `AGENTS.md` (docs changelog, OpenAPI file, etc.).
6. Gate: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test:unit && pnpm test:int && pnpm build`. Fix failures. Never skip.
7. Commit `chore(release): vX.Y.Z`. Lightweight tag `vX.Y.Z` on it.
8. Report: version, npm dist-tag CI will set (`beta`, `latest` or `latest-N`), push commands. Push branch, then tag, only when user asks. Never move tag: bad release = new version.
