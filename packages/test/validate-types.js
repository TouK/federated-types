#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const typingsFile = path.resolve(__dirname, '../../test-results/testTest.d.ts');

console.log(`Validating ${chalk.blue('testTest.d.ts')}...`);

if (!fs.existsSync(typingsFile)) {
    console.error(chalk.red(`ERROR: ${chalk.blue('testTest.d.ts')} was not generated`));
    process.exit(1);
}

const content = fs.readFileSync(typingsFile, 'utf8');

const requiredModules = [
    'declare module "testTest/test"',
    'declare module "testTest/env"',
    'declare module "testTest/Component"',
];

const requiredExports = ['export const TestComponent', 'export const envConfig'];

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

console.log(chalk.green(`✓ All validations passed for ${chalk.blue('testTest.d.ts')}`));
