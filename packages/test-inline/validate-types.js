#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const typingsFile = path.resolve(__dirname, '../../test-results/testInline.d.ts');

console.log('Validating testInline.d.ts...');

if (!fs.existsSync(typingsFile)) {
    console.error('ERROR: testInline.d.ts was not generated');
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

console.log('✓ All validations passed for testInline.d.ts');
