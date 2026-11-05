#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ts = require('typescript');

const typingsFile = path.resolve(__dirname, '../../test-results/testPrune.d.ts');

console.log(`Validating ${chalk.blue('testPrune.d.ts')}...`);

if (!fs.existsSync(typingsFile)) {
    console.error(chalk.red(`ERROR: ${chalk.blue('testPrune.d.ts')} was not generated`));
    process.exit(1);
}

const content = fs.readFileSync(typingsFile, 'utf8');

const requiredSnippets = [
    // exposed modules and their alias
    'declare module "testPrune/Widget"',
    'declare module "testPrune/WidgetAlias"',
    // reachable through the exposed types, directly and transitively
    'export interface WidgetProps',
    'export interface Theme',
    'export interface HelperConfig',
    // unreachable, but kept because it augments the global scope
    '__TEST_PRUNE__',
];

// only used by the implementation, not by the exposed types
const forbiddenSnippets = ['RenderInternals'];

let errors = 0;

requiredSnippets.forEach((snippet) => {
    if (!content.includes(snippet)) {
        console.error(chalk.red(`ERROR: Missing: ${chalk.blue(snippet)}`));
        errors++;
    }
});

forbiddenSnippets.forEach((snippet) => {
    if (content.includes(snippet)) {
        console.error(chalk.red(`ERROR: Not pruned: ${chalk.blue(snippet)}`));
        errors++;
    }
});

// the pruned typings must still be self-contained
const program = ts.createProgram([typingsFile], { noEmit: true, types: [] });
ts.getPreEmitDiagnostics(program).forEach((diagnostic) => {
    console.error(
        chalk.red('ERROR:'),
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    );
    errors++;
});

if (errors > 0) {
    console.error(chalk.red(`\nValidation failed with ${errors} error(s)`));
    process.exit(1);
}

console.log(chalk.green(`✓ All validations passed for ${chalk.blue('testPrune.d.ts')}`));
