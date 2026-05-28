# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` is the canonical contributor guide for this repo — read it for detailed code style, commit conventions, and workflow recipes. This file is a short orientation pointing at the parts most useful when starting work.

## Language

All in-repo artifacts are written in English: code, comments, config file comments, docs, commit messages, PR descriptions. This is a public npm package (`@touk/federated-types`) with external contributors, so the project's working language is English regardless of the language used in chat with the maintainer.

## What this project is

`@touk/federated-types` is a single-file Node CLI (`cli.js`, plain JavaScript — not TypeScript) that generates ambient `.d.ts` declarations for Webpack 5 Module Federation `exposes` entries. The output lands in `node_modules/@types/__federated_types/` by default so the TS compiler picks it up without extra config.

Two consumers feed the same CLI from `packages/`:
- `packages/test/` — file-based config via `federation.config.json`
- `packages/test-inline/` — inline config via `--name` / `--exposes` flags

Each workspace's `make-types` script generates types into the root `test-results/` directory, then runs `validate-types.js` to grep the output for required `declare module` blocks and exports. That double-step (generate + validate) is what `npm test` runs across both workspaces.

## Commands

```bash
npm install                                  # install (uses workspaces)
npm test                                     # generate + validate across both packages
npm run make-types -w packages/test          # single workspace: file-based config
npm run make-types -w packages/test-inline   # single workspace: inline config
./cli.js --config ./packages/test/federation.config.json --outputDir ./test-results  # invoke CLI directly
npx prettier --write .                       # format
```

Node version is pinned in `.nvmrc` (v22.14.0). `npm test` is the closest thing to a CI gate — there is no separate lint step beyond Prettier.

## Architecture notes worth knowing up front

- **`cli.js` is the whole tool.** Argument parsing is hand-rolled via `hasArg` / `getArg` / `getAllArgs` (the last one handles repeated `--exposes key path` pairs). No yargs/commander.
- **Config resolution priority**: inline (`--name` + `--exposes`) > `--config <path>` > recursive auto-find of `federation.config.json` from cwd. Mixing inline + `--config` warns and uses inline.
- **Type emission** uses the TypeScript compiler API: `ts.createProgram` with `declaration: true`, `emitDeclarationOnly: true`, `outFile`. The single emitted file is then post-processed with a regex over `declare module "..."` to rewrite each module's name to `<federationName>/<exposeKey>` (e.g. `testTest/Component`). Aliases — multiple `exposes` keys pointing at the same file — get extra `declare module` blocks that re-export from the canonical one.
- **Path normalization is load-bearing for Windows.** `path.join(...).replace(/[\\/]/g, '/')` runs anywhere a module name is built; don't drop it.
- **`index.d.ts` is append-only.** Each run adds `export * from './<name>';` if absent. When writing into `node_modules/@types/__federated_types/`, the CLI also copies `typings.package.tmpl.json` as `package.json` so TS treats it as an `@types` package.

## Release & commits

`semantic-release` runs from `dev` (channel `beta`, prerelease tag) and `master`. Commit messages must follow Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, with optional `(deps)` / `(deps-dev)` / `(release)` scopes) — commitlint via Husky enforces this on commit. Don't hand-edit `CHANGELOG.md` or bump `version` in `package.json`; semantic-release owns both.
