import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export function checkRuntime(root = resolve('.')) {
  const directory = resolve(root, 'assets/runtime/world-v1');
  const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || manifest.assets.length !== 11) throw new Error('Incomplete runtime artwork');
  for (const asset of manifest.assets) {
    for (const [path, hash, size] of [
      [resolve(root, asset.source), asset.sourceSha256, asset.sourceBytes],
      [resolve(directory, asset.file), asset.sha256, asset.bytes],
    ]) {
      const bytes = readFileSync(path);
      if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== hash)
        throw new Error(`Stale runtime artwork: ${asset.id}`);
    }
  }
  return manifest.assets.length;
}
