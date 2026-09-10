import { checkRuntime } from "./check-runtime.mjs";
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePack } from './validate.mjs';

const root = resolve('assets/sprites');
const entries = existsSync(root) ? readdirSync(root, { withFileTypes: true }) : [];
if (!entries.length) console.log('No production asset packs yet; art delivery is incomplete.');
let failures = 0;
for (const entry of entries) {
  try {
    if (!entry.isDirectory()) throw new Error('production root accepts pack directories only');
    console.log(JSON.stringify(validatePack(resolve(root, entry.name), { release: true })));
  } catch (error) {
    failures++;
    console.error(`${entry.name}: ${error.message}`);
  }
}
if (failures) process.exitCode = 1;

console.log(`Runtime artwork: ${checkRuntime()} verified files`);
