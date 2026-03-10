#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const typingsFile = path.resolve(__dirname, '../../test-results/testTest.d.ts');

console.log('Validating testTest.d.ts...');

if (!fs.existsSync(typingsFile)) {
    console.error('ERROR: testTest.d.ts was not generated');
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
        console.error(`ERROR: Missing module declaration: ${module}`);
        errors++;
    }
});

requiredExports.forEach((exp) => {
    if (!content.includes(exp)) {
        console.error(`ERROR: Missing export: ${exp}`);
        errors++;
    }
});

if (errors > 0) {
    console.error(`\nValidation failed with ${errors} error(s)`);
    process.exit(1);
}

console.log('✓ All validations passed for testTest.d.ts');
