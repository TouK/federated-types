#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const findNodeModules = require('find-node-modules');
const ts = require('typescript');

const formatHost = {
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
};

function reportDiagnostic(diagnostic) {
  console.log("TS Error", diagnostic.code, ":", ts.flattenDiagnosticMessageText( diagnostic.messageText, formatHost.getNewLine()));
}

const [nodeModules] = findNodeModules({ cwd: process.argv[1], relative: false });

const hasArg = (argName) => {
    const argIndex = process.argv.indexOf(argName);
    return argIndex !== -1;
};
const getArg = (argName) => {
    const argIndex = process.argv.indexOf(argName);
    return argIndex !== -1 ? process.argv[argIndex + 1] : null;
};

const nodeModulesOutputDir = path.resolve(nodeModules, '@types/__federated_types/');
const saveToNodeMoulesArg = hasArg('--saveToNodeModules');
const outDirArg = getArg('--outputDir');

const outputDir = outDirArg
    ? path.resolve('./', outDirArg)
    : nodeModulesOutputDir;

const outputDirs = outputDir !== nodeModulesOutputDir && saveToNodeMoulesArg
    ? [nodeModulesOutputDir, outputDir]
    : [outputDir];

const configPathArg = getArg('--config');
const configPath = configPathArg
    ? path.resolve(configPathArg)
    : null;

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

    for( let i = 0; i < queue.length; i++ ) {
        return findFederationConfig(queue[i]);
    }
};

if (configPath && !fs.existsSync(configPath)) {
    console.error(`ERROR: Unable to find a provided config: ${configPath}`);
    process.exit(1);
}

const federationConfigPath = configPath || findFederationConfig('./');


if (federationConfigPath === undefined) {
    console.error(`ERROR: Unable to find a federation.config.json file in this package`);
    process.exit(1);
}

console.log(`Using config file: ${federationConfigPath}`);

const federationConfig = require(federationConfigPath);
const compileFiles = Object.values(federationConfig.exposes);
const compileKeys = Object.keys(federationConfig.exposes);

function getModuleDeclareName(exposeName) {
    // windows paths 🤦
    return path.join(federationConfig.name, exposeName).replace(/[\\/]/g, '/');
}

try {
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
        jsx: 'react',
        esModuleInterop: true,
    });

    const { emitSkipped, diagnostics } = program.emit();

    diagnostics.forEach(reportDiagnostic)

    if (emitSkipped) {
        process.exit(0)
    }

    let typing = fs.readFileSync(outFile, { encoding: 'utf8', flag: 'r' });

    const moduleRegex = RegExp(/declare module "(.*)"/, 'g');
    const moduleNames = [];

    while ((execResults = moduleRegex.exec(typing)) !== null) {
        moduleNames.push(execResults[1]);
    }

    moduleNames.forEach((name) => {
        // exposeName - relative name of exposed component (if not found - just take moduleName)
        const [exposeName = name, ...aliases] = compileKeys.filter(key => federationConfig.exposes[key].endsWith(name));
        const regex = RegExp(`"${name}"`, 'g');

        const moduleDeclareName = getModuleDeclareName(exposeName);

        // language=TypeScript
        const createAliasModule = name => `
            declare module "${getModuleDeclareName(name)}" {
                export * from "${moduleDeclareName}"
            }
        `;

        typing = [
            typing.replace(regex, `"${moduleDeclareName}"`),
            ...aliases.map(createAliasModule),
        ].join('\n');
    });

    outputDirs.forEach(_outputDir => {
        const _outFile = path.resolve(_outputDir, `${federationConfig.name}.d.ts`);
        console.log('writing typing file:', _outFile);

        fs.writeFileSync(_outFile, typing);

        console.debug(`using output dir: ${_outputDir}`);
        // if we are writing to the node_modules/@types directory, add a package.json file
        if (_outputDir.includes(path.join('node_modules', '@types'))) {
            const packageJsonPath = path.resolve(_outputDir, 'package.json');

            if (!fs.existsSync(packageJsonPath)) {
                console.debug('writing package.json:', packageJsonPath);
                fs.copyFileSync(path.resolve(__dirname, 'typings.package.tmpl.json'), packageJsonPath);
            } else {
                console.debug(packageJsonPath, 'already exists');
            }
        }

        // write/update the index.d.ts file
        const indexPath = path.resolve(_outputDir, 'index.d.ts');
        const importStatement = `export * from './${federationConfig.name}';`;

        if (!fs.existsSync(indexPath)) {
            console.log('creating index.d.ts file');
            fs.writeFileSync(indexPath, `${importStatement}\n`);
        } else {
            console.log('updating index.d.ts file');
            const contents = fs.readFileSync(indexPath);
            if (!contents.includes(importStatement)) {
                fs.writeFileSync(indexPath, `${contents}${importStatement}\n`);
            }
        }
    });
    console.debug('Success!');
} catch (e) {
    console.error(`ERROR:`, e);
    process.exit(1);
}
