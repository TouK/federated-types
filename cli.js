#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const ts = require('typescript');
const chalk = require('chalk');

const formatHost = {
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine,
};

function reportDiagnostic(diagnostic) {
    console.log(
        chalk.red('TS Error'),
        chalk.yellow(diagnostic.code),
        ':',
        ts.flattenDiagnosticMessageText(diagnostic.messageText, formatHost.getNewLine())
    );
}

// nearest node_modules directory up from the CLI script
const findNodeModules = (start) => {
    let dir = path.resolve(start);
    while (!fs.existsSync(path.join(dir, 'node_modules'))) {
        const parent = path.dirname(dir);
        if (parent === dir) {
            return path.resolve('node_modules');
        }
        dir = parent;
    }
    return path.join(dir, 'node_modules');
};

const nodeModules = findNodeModules(process.argv[1]);

const hasArg = (argName) => {
    const argIndex = process.argv.indexOf(argName);
    return argIndex !== -1;
};
const getArg = (argName) => {
    const argIndex = process.argv.indexOf(argName);
    return argIndex !== -1 ? process.argv[argIndex + 1] : null;
};
const getAllArgs = (argName) => {
    const results = [];
    let i = 2; // process.argv starts with node and script path

    while (i < process.argv.length) {
        if (process.argv[i] === argName) {
            // Next two arguments are key and value
            if (i + 2 < process.argv.length) {
                results.push([process.argv[i + 1], process.argv[i + 2]]);
                i += 3; // skip argName, key, value
            } else {
                console.error(chalk.red('ERROR:'), '--exposes requires two arguments (key path)');
                process.exit(1);
            }
        } else {
            i++;
        }
    }
    return results;
};

const nodeModulesOutputDir = path.resolve(nodeModules, '@types/__federated_types/');
const saveToNodeMoulesArg = hasArg('--saveToNodeModules');
const outDirArg = getArg('--outputDir');

const outputDir = outDirArg ? path.resolve('./', outDirArg) : nodeModulesOutputDir;

const outputDirs =
    outputDir !== nodeModulesOutputDir && saveToNodeMoulesArg
        ? [nodeModulesOutputDir, outputDir]
        : [outputDir];

const configPathArg = getArg('--config');
const configPath = configPathArg ? path.resolve(configPathArg) : null;

const nameArg = getArg('--name');
const exposesArgs = getAllArgs('--exposes');
const verboseArg = hasArg('--verbose') || process.env.npm_config_loglevel === 'verbose';
const pruneArg = hasArg('--prune');

const log = (...args) => console.log(...args);
const logDebug = (...args) => verboseArg && console.debug(chalk.gray.dim(...args));

const findFederationConfig = (base) => {
    let files = fs.readdirSync(base);
    let queue = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const newBase = path.join(base, file);
        if (file === 'federation.config.json') {
            return path.resolve('./', newBase);
        } else if (fs.statSync(newBase).isDirectory() && !newBase.includes('node_modules')) {
            queue.push(newBase);
        }
    }

    for (let i = 0; i < queue.length; i++) {
        return findFederationConfig(queue[i]);
    }
};

let federationConfig;

// Priority: inline config > --config > auto-find
if (nameArg || exposesArgs.length > 0) {
    // Inline config mode
    if (!nameArg || exposesArgs.length === 0) {
        console.error(
            chalk.red('ERROR:'),
            'Both --name and --exposes are required for inline config'
        );
        process.exit(1);
    }

    if (configPath) {
        console.warn(
            chalk.yellow('WARNING:'),
            'Both inline config and --config provided. Using inline config.'
        );
    }

    const exposes = {};

    exposesArgs.forEach(([key, value]) => {
        // Normalize key - add ./ if missing
        const normalizedKey = key.startsWith('./') ? key : `./${key}`;
        exposes[normalizedKey] = value;
    });

    federationConfig = {
        name: nameArg,
        exposes: exposes,
    };

    log('Using inline config');
    logDebug(JSON.stringify(federationConfig, null, 2));
} else {
    // File-based config (current behavior)
    if (configPath && !fs.existsSync(configPath)) {
        console.error(chalk.red('ERROR:'), `Unable to find a provided config: ${configPath}`);
        process.exit(1);
    }

    const federationConfigPath = configPath || findFederationConfig('./');

    if (federationConfigPath === undefined) {
        console.error(
            chalk.red('ERROR:'),
            'Unable to find a federation.config.json file in this package'
        );
        process.exit(1);
    }

    log('Using config file', chalk.blue.bold(federationConfigPath));
    federationConfig = require(federationConfigPath);
}

const compileFiles = Object.values(federationConfig.exposes);
const compileKeys = Object.keys(federationConfig.exposes);

function getModuleDeclareName(exposeName) {
    // windows paths 🤦
    return path.join(federationConfig.name, exposeName).replace(/[\\/]/g, '/');
}

// Matches the module specifier of `from "x"`, `import("x")`, `import "x"` and `require("x")`.
const moduleReferenceRegex = /\b(?:from|import|require)\s*\(?\s*(["'])([^"'\n]+)\1/g;
// Global or module augmentations take effect without being imported, so such modules are always kept.
// Inside a `declare module` block tsc emits them without the `declare` keyword.
const augmentationRegex = /^\s+(?:declare\s+)?(?:global\s*\{|module\s+["'])/m;

/**
 * Drops the top-level `declare module` blocks that cannot be reached from the exposed modules
 * through module references. Text outside the blocks is kept as is.
 */
function pruneUnreachableModules(typing, isExposedModule) {
    const blockRegex = /^declare module "([^"]+)" \{\n[\s\S]*?^\}\n?/gm;
    const segments = [];
    const modules = new Map();
    let lastIndex = 0;
    let match;

    while ((match = blockRegex.exec(typing)) !== null) {
        segments.push(typing.slice(lastIndex, match.index));
        const block = { name: match[1], text: match[0] };
        segments.push(block);
        modules.set(block.name, block);
        lastIndex = blockRegex.lastIndex;
    }
    segments.push(typing.slice(lastIndex));

    const roots = Array.from(modules.values()).filter(
        (block) => isExposedModule(block.name) || augmentationRegex.test(block.text)
    );

    if (!roots.some((block) => isExposedModule(block.name))) {
        console.warn(
            chalk.yellow('WARNING:'),
            'No exposed module found in the emitted typings, skipping --prune'
        );
        return typing;
    }

    const reachable = new Set();
    const queue = [];
    const visit = (text) => {
        for (const [, , name] of text.matchAll(moduleReferenceRegex)) {
            const block = modules.get(name);
            if (block && !reachable.has(block)) {
                reachable.add(block);
                queue.push(block);
            }
        }
    };

    segments.filter((segment) => typeof segment === 'string').forEach(visit);
    roots.forEach((block) => {
        reachable.add(block);
        queue.push(block);
    });
    while (queue.length > 0) {
        visit(queue.pop().text);
    }

    logDebug(`--prune: kept ${reachable.size} of ${modules.size} modules`);

    return segments
        .filter((segment) => typeof segment === 'string' || reachable.has(segment))
        .map((segment) => (typeof segment === 'string' ? segment : segment.text))
        .join('');
}

try {
    fs.mkdirSync(outputDir, { recursive: true });
    const outFile = path.resolve(outputDir, `${federationConfig.name}.d.ts`);
    if (fs.existsSync(outFile)) {
        fs.unlinkSync(outFile);
    }

    // write the typings file
    const program = ts.createProgram(compileFiles, {
        outFile,
        declaration: true,
        emitDeclarationOnly: true,
        skipLibCheck: true,
        noCheck: true,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
    });

    const { emitSkipped, diagnostics } = program.emit();

    diagnostics.forEach(reportDiagnostic);

    if (emitSkipped) {
        process.exit(0);
    }

    let typing = fs.readFileSync(outFile, { encoding: 'utf8', flag: 'r' });

    const moduleRegex = RegExp(/declare module "(.*)"/, 'g');
    const exposedPaths = compileKeys.map((key) => [
        key,
        federationConfig.exposes[key].replace(/\.(tsx?|jsx?)$/, ''),
    ]);
    const findExposeKeys = (name) =>
        exposedPaths
            .filter(([, normalizedPath]) => normalizedPath.endsWith(name))
            .map(([key]) => key);

    if (pruneArg) {
        typing = pruneUnreachableModules(typing, (name) => findExposeKeys(name).length > 0);
    }

    // module name emitted by tsc -> name it is declared under in the federated typings
    const renames = new Map();
    const aliasModules = [];

    let execResults;
    while ((execResults = moduleRegex.exec(typing)) !== null) {
        const name = execResults[1];
        if (renames.has(name)) {
            continue;
        }

        // exposeName - relative name of exposed component (if not found - just take moduleName)
        const [exposeName = name, ...aliases] = findExposeKeys(name);

        const moduleDeclareName = getModuleDeclareName(exposeName);
        renames.set(name, moduleDeclareName);

        // language=TypeScript
        aliases.forEach((alias) =>
            aliasModules.push(`
            declare module "${getModuleDeclareName(alias)}" {
                export * from "${moduleDeclareName}"
            }
        `)
        );
    }

    if (renames.size > 0) {
        // Rename every exact quoted occurrence of a module name in a single pass.
        const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const namesRegex = RegExp(`"(${Array.from(renames.keys(), escapeRegExp).join('|')})"`, 'g');
        typing = typing.replace(namesRegex, (match, name) => `"${renames.get(name)}"`);
    }

    typing = [typing, ...aliasModules].join('\n');

    outputDirs.forEach((_outputDir) => {
        const _outFile = path.resolve(_outputDir, `${federationConfig.name}.d.ts`);

        logDebug('writing typing file:', _outFile);
        fs.mkdirSync(path.dirname(_outFile), { recursive: true });
        fs.writeFileSync(_outFile, typing);

        logDebug(`using output dir: ${_outputDir}`);
        // if we are writing to the node_modules/@types directory, add a package.json file
        if (_outputDir.includes(path.join('node_modules', '@types'))) {
            const packageJsonPath = path.resolve(_outputDir, 'package.json');

            if (!fs.existsSync(packageJsonPath)) {
                logDebug('writing package.json:', packageJsonPath);
                fs.copyFileSync(
                    path.resolve(__dirname, 'typings.package.tmpl.json'),
                    packageJsonPath
                );
            } else {
                logDebug(packageJsonPath, 'already exists');
            }
        }

        // write/update the index.d.ts file
        const indexPath = path.resolve(_outputDir, 'index.d.ts');
        const importStatement = `export * from './${federationConfig.name}';`;

        if (!fs.existsSync(indexPath)) {
            logDebug('creating index.d.ts file');
            fs.writeFileSync(indexPath, `${importStatement}\n`);
        } else {
            logDebug('updating index.d.ts file');
            const contents = fs.readFileSync(indexPath);
            if (!contents.includes(importStatement)) {
                fs.writeFileSync(indexPath, `${contents}${importStatement}\n`);
            }
        }
    });
    log(chalk.green('✓'), `Generated types for ${chalk.blue.bold(federationConfig.name)}`);
} catch (e) {
    console.error(chalk.red('ERROR:'), e);
    process.exit(1);
}
