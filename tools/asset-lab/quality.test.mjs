import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exportChecks } from './quality.mjs';
const pack = JSON.parse(readFileSync(new URL('../../assets/workbench/baseline-v1/pack.json', import.meta.url)));
test('all exported frames preserve proportions, common scale and explicit attachments', () => {
  assert.ok(exportChecks(pack).every(c => c.pass));
});
for (const [name, mutate] of [
  ['squashed frame', a => { a.exportMetrics[0].outputSize[1] -= 3; }],
  ['per-pose scale', a => { a.exportMetrics[1].scale *= .8; }],
  ['missing attachment', a => { delete a.frameAnchors[15]; }],
  ['missing eye region', a => { delete a.frameFaceAreas[6]; }],
  ['missing export record', a => { a.exportMetrics.pop(); }],
]) test(`reject ${name}`, () => {
  const broken = structuredClone(pack); mutate(broken.assets[0]);
  assert.ok(exportChecks(broken).some(c => !c.pass));
});
