// Playwright は apps/e2e の依存から読む（presentation はワークスペースの外にあるため）。
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'apps/e2e/package.json'));
export const { chromium } = require('@playwright/test');
export const ROOT = root;
