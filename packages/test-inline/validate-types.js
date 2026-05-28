#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const typingsFile = path.resolve(__dirname, '../../test-results/testInline.d.ts');

console.log(`Validating ${chalk.blue('testInline.d.ts')}...`);

if (!fs.existsSync(typingsFile)) {
    console.error(chalk.red(`ERROR: ${chalk.blue('testInline.d.ts')} was not generated`));
    process.exit(1);
}

const content = fs.readFileSync(typingsFile, 'utf8');

const requiredModules = [
    'declare module "testInline/App"',
    'declare module "testInline/utils/helper"',
];

const requiredExports = [
    'export interface AppProps',
    'export const App: React.FC<AppProps>',
    'export interface HelperConfig',
    'export function createHelper',
    'export const defaultConfig',
];

let errors = 0;

requiredModules.forEach((module) => {
    if (!content.includes(module)) {
        console.error(chalk.red(`ERROR: Missing module declaration: ${chalk.blue(module)}`));
        errors++;
    }
});

requiredExports.forEach((exp) => {
    if (!content.includes(exp)) {
        console.error(chalk.red(`ERROR: Missing export: ${chalk.blue(exp)}`));
        errors++;
    }
});

if (errors > 0) {
    console.error(chalk.red(`\nValidation failed with ${errors} error(s)`));
    process.exit(1);
}

console.log(chalk.green(`✓ All validations passed for ${chalk.blue('testInline.d.ts')}`));
