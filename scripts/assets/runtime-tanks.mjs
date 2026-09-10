import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const files = ['cabin-standard', 'tracks-standard', 'pilot-frog', 'effect-spark', 'effect-smoke', 'effect-dust', 'effect-muzzle', 'effect-explosion', 'effect-energy', 'effect-drill', 'effect-dig', ...['cannon', 'triple', 'multiple', 'drill', 'laser', 'digger', 'floater', 'stinger'].flatMap(id => [`weapon-${id}`, `projectile-${id}`])];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function runtimeTanks(check = true) {
  const root = resolve('assets/runtime/tanks-v1');
  const entries = files.map(id => {
    const source = `assets/workbench/baseline-v2/${id}.png`;
    const bytes = readFileSync(source), file = `${id}.png`;
    if (check) {
      if (!bytes.equals(readFileSync(resolve(root, file)))) throw new Error(`runtime tank differs: ${id}`);
    } else {
      mkdirSync(root, { recursive: true });
      writeFileSync(resolve(root, file), bytes);
    }
    return { file, source, bytes: bytes.length, sha256: digest(bytes) };
  });
  const manifest = JSON.stringify({ version: 1, artPixelsPerCell: 12, frameSize: [192, 160], visualApproval: 'pending', entries }, null, 2) + '\n';
  if (check) {
    if (readFileSync(resolve(root, 'manifest.json'), 'utf8') !== manifest) throw new Error('runtime tank manifest differs');
  } else writeFileSync(resolve(root, 'manifest.json'), manifest);
  return entries.length;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(`Runtime tanks: ${runtimeTanks(!process.argv.includes('--write'))} verified files`);
