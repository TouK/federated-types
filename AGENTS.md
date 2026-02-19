# Federated Types - Agent Guidelines

## Project Overview

**federated-types** is a TypeScript tooling package that generates ambient type definitions for Webpack 5 Module Federation in monorepos. It provides a CLI command `make-federated-types` that creates TypeScript declaration files for federated modules.

- **Main entry**: `cli.js` - Node.js CLI tool
- **Language**: JavaScript (Node.js) with TypeScript peer dependency
- **Architecture**: NPM workspaces monorepo with test package in `packages/test/`
- **Key dependencies**: TypeScript compiler API, find-node-modules

## Build, Test & Lint Commands

### Installation

```bash
npm install
```

### Testing

```bash
# Run tests in all workspaces (generates types for test package)
npm test

# Run single test package
npm run make-types -w packages/test

# Run CLI directly for specific package
./cli.js --outputDir ./test-results
./cli.js --config ./path/to/federation.config.json --outputDir ./output
```

### Formatting

```bash
# Format code with Prettier
npx prettier --write .

# Check formatting
npx prettier --check .
```

### Release

```bash
# Semantic release (automated via CI)
npm run semantic-release
```

## Code Style Guidelines

### Formatting (Prettier)

- **Tab width**: 4 spaces
- **Single quotes**: Always use `'` instead of `"`
- **Print width**: 100 characters
- **Trailing commas**: ES5 style (objects, arrays)
- **Semicolons**: Required

### File Structure

```
/
├── cli.js                           # Main CLI entry point
├── typings.package.tmpl.json        # Template for generated package.json
├── packages/
│   └── test/                        # Test workspace
│       ├── federation.config.json   # Federation configuration
│       └── src/                     # Test source files
└── test-results/                    # Generated type definitions (gitignored)
```

### Naming Conventions

- **Variables/functions**: camelCase (e.g., `findFederationConfig`, `getModuleDeclareName`)
- **Constants**: camelCase for regular, UPPER_CASE for true constants
- **Files**: kebab-case for configs, camelCase.js for code
- **Module names**: Follow federation config naming (e.g., `testTest`)

### Code Patterns

#### Error Handling

```javascript
// CLI errors - exit with code 1 and descriptive message
if (!fs.existsSync(configPath)) {
    console.error(`ERROR: Unable to find a provided config: ${configPath}`);
    process.exit(1);
}

// Catch blocks with context
try {
    // operation
} catch (e) {
    console.error(`ERROR:`, e);
    process.exit(1);
}
```

#### Argument Parsing

```javascript
const hasArg = (argName) => {
    const argIndex = process.argv.indexOf(argName);
    return argIndex !== -1;
};
const getArg = (argName) => {
    const argIndex = process.argv.indexOf(argName);
    return argIndex !== -1 ? process.argv[argIndex + 1] : null;
};
```

#### Path Handling

- Use `path.resolve()` for absolute paths
- Use `path.join()` for combining paths
- Always normalize with `.replace(/[\\/]/g, '/')` for cross-platform (Windows/Unix)

### TypeScript Compiler Integration

- Use TypeScript compiler API: `ts.createProgram()`, `program.emit()`
- Report diagnostics: `ts.flattenDiagnosticMessageText()`
- Compiler options:
    ```javascript
    {
        outFile,
        declaration: true,
        emitDeclarationOnly: true,
        skipLibCheck: true,
        jsx: 'react',
        esModuleInterop: true,
    }
    ```

### Module Declaration Generation

- Parse module declarations with regex: `/declare module "(.*)"/g`
- Transform module names based on federation config's `exposes` mapping
- Support aliases by creating re-export modules
- Generate cross-platform paths (normalize slashes)

### File Operations

- Create directories recursively: `fs.mkdirSync(dir, { recursive: true })`
- Check existence before operations: `fs.existsSync()`
- Use synchronous fs operations in CLI context
- Clean up old files before regenerating: `fs.unlinkSync()`

### Console Output

- Info: `console.log()` for progress messages
- Debug: `console.debug()` for detailed diagnostics
- Errors: `console.error()` with `ERROR:` prefix

## Commit Message Convention

Uses **Conventional Commits** via commitlint:

- `feat:` - New features
- `fix:` - Bug fixes
- `chore:` - Maintenance tasks
- `build:` - Build system/dependencies
- `test:` - Test additions/changes
- Scopes: `(deps)`, `(deps-dev)`, `(release)`
- Examples: `feat: "--saveToNodeModules" param`, `fix: create missing dir`

## Release Process

Automated via semantic-release:

- **Branches**: `master` (stable), `dev` (beta prereleases)
- **Changelog**: Auto-generated
- **Version**: Automated based on commit types
- **NPM**: Published to `@touk/federated-types`

## Key Workflows

### Adding New CLI Arguments

1. Add argument parsing with `hasArg()` or `getArg()`
2. Update logic to handle new parameter
3. Document in README.md
4. Add test case in `packages/test/`

### Modifying Type Generation

1. Update `cli.js` compiler options or module transformation logic
2. Test with `npm test` to verify generated types
3. Check output in `test-results/` directory
4. Ensure Windows path compatibility

### Debugging

- Check TypeScript diagnostics output
- Verify `federation.config.json` structure
- Inspect generated `.d.ts` files in output directory
- Test with actual module federation project

## Important Notes

- This is a **tooling package** - changes must not break existing generated types
- **Cross-platform compatibility** is critical (Windows/Unix path handling)
- TypeScript peer dependency must stay `>4.0.0`
- Generated files go to `node_modules/@types/__federated_types/` by default
- Support both node_modules and custom output directories
