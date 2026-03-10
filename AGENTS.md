# Federated Types - Agent Guidelines

## Project Overview

**federated-types** generates TypeScript type definitions for Webpack 5 Module Federation in monorepos. CLI tool that creates `.d.ts` files for federated modules.

- **Main entry**: `cli.js` - Node.js CLI (JavaScript, not TypeScript)
- **Node version**: v22.14.0 (see `.nvmrc`)
- **Architecture**: NPM workspaces monorepo with test packages
- **Key dependencies**: TypeScript compiler API, find-node-modules

## Build, Test & Lint Commands

```bash
# Install dependencies
npm install

# Run all tests (both workspaces with validation)
npm test

# Run single test workspace
npm run make-types -w packages/test        # file-based config
npm run make-types -w packages/test-inline # inline config

# Test CLI directly
./cli.js --config ./packages/test/federation.config.json --outputDir ./test-results
./cli.js --name myApp --exposes App ./src/App.tsx --outputDir ./test-results

# Format code
npx prettier --write .    # Format all
npx prettier --check .    # Check only
```

## Code Style Guidelines

### Prettier Configuration

- **Tab width**: 4 spaces
- **Quotes**: Single quotes (`'`)
- **Print width**: 100 characters
- **Trailing commas**: ES5 (objects, arrays)
- **Semicolons**: Required

### Naming Conventions

- **Variables/functions**: camelCase (`findFederationConfig`, `getModuleDeclareName`)
- **Constants**: camelCase (no UPPER_CASE unless truly constant)
- **Files**: `kebab-case.js` for configs, `camelCase.js` for code
- **Module names**: Follow federation config (e.g., `testTest`, `testInline`)

### Error Handling

```javascript
if (!fs.existsSync(configPath)) {
    console.error(`ERROR: Unable to find a provided config: ${configPath}`);
    process.exit(1);
}
```

### Argument Parsing

```javascript
const hasArg = (argName) => process.argv.indexOf(argName) !== -1;
const getArg = (argName) => process.argv[process.argv.indexOf(argName) + 1] || null;
const getAllArgs = (argName) => {
    // Returns [[key, value], ...] for repeated --exposes args
    // See cli.js:34-50 for implementation
};
```

### Path & File Operations

- Use `path.resolve()` for absolute, `path.join()` for combining
- **Always normalize**: `.replace(/[\\/]/g, '/')` for Windows compatibility
- Synchronous fs ops: `fs.mkdirSync(dir, {recursive: true})`, `fs.existsSync()`
- Console: `console.log()` (progress), `console.error('ERROR:')` (errors)

## TypeScript Compiler Integration

```javascript
const program = ts.createProgram(compileFiles, {
    outFile,
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
});
```

**Module transformations**: Parse `/declare module "(.*)"/g`, transform based on `exposes`, normalize paths

## Commit Message Convention

**Conventional Commits** enforced via commitlint:

- `feat:` - New features
- `fix:` - Bug fixes
- `test:` - Test additions/changes
- `chore:` - Maintenance (deps, config)
- `docs:` - Documentation only
- Scopes: `(deps)`, `(deps-dev)`, `(release)`

Examples:

- `feat: add inline config via --name and --exposes`
- `fix: normalize Windows paths in module names`
- `test: add validation for generated types`

## Key Workflows

### Adding New CLI Arguments

1. Add parsing with `hasArg()`, `getArg()`, or `getAllArgs()`
2. Implement logic in `cli.js`
3. Add validation and error messages
4. Update `README.md` with examples
5. Add test case in appropriate workspace

### Adding Tests

1. Create test files in workspace (`packages/test/` or `packages/test-inline/`)
2. Add/update `validate-types.js` with assertions
3. Run `npm test` to verify
4. Assertions should check: file existence, module declarations, exports/interfaces

### Modifying Type Generation

1. Update `cli.js` compiler options or transformation logic
2. Run `npm test` - verify all validations pass
3. Check output in `test-results/` directory
4. Test Windows path compatibility (use `.replace(/[\\/]/g, '/')`)
5. Ensure backward compatibility with existing configs

## Important Notes

- **Backward compatibility** - Don't break existing federation.config.json files
- **Cross-platform** - Always test path handling (Windows uses `\`, Unix uses `/`)
- **Inline config priority** - inline > --config > auto-find
- **Auto-prefix** - Keys without `./` get prefixed automatically (e.g., `App` → `./App`)
- **TypeScript peer dependency** - Must stay `>4.0.0`
- **Default output** - `node_modules/@types/__federated_types/`
- **Test workspaces** - Both run validation after generation
