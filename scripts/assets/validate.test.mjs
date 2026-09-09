import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { validatePack, digestPack } from './validate.mjs';
import { crc32, inspectPng } from './png.mjs';

function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function png({ colorType = 3, alpha = 255, width = 2, height = 2, raw } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = colorType;
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header),
    chunk('PLTE', Buffer.from([0, 0, 0, 255, 255, 255])),
    chunk('tRNS', Buffer.from([0, alpha])),
    chunk('IDAT', deflateSync(raw ?? Buffer.concat(Array.from({ length: height }, () => Buffer.from([0, ...Array.from({ length: width }, (_, i) => i % 2)]))))), chunk('IEND', Buffer.alloc(0)),
  ]);
}
function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'game-asset-test-'));
  const pack = {
    version: 1, id: 'test-pack', metricsStatus: 'draft', artPixelsPerCell: 4,
    assets: [{ id: 'test-icon', kind: 'ui', file: 'sprite.png', source: 'source.aseprite',
      frameSize: [2, 2], paletteRoles: ['transparent', 'fixed'],
      anchors: { origin: [0, 0] }, clips: { idle: { frames: [0], durationsMs: [100], loop: true } } }],
  };
  writeFileSync(join(root, 'sprite.png'), png());
  writeFileSync(join(root, 'source.aseprite'), 'fixture source, not production art');
  const save = () => writeFileSync(join(root, 'pack.json'), JSON.stringify(pack));
  save();
  try { fn({ root, pack, save }); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('valid indexed draft pack passes structural validation', () => fixture(({ root }) => {
  assert.deepEqual(validatePack(root), { id: 'test-pack', assets: 1, release: false });
}));
for (const [name, change] of [
  ['empty pack', p => { p.assets = []; }],
  ['duplicate IDs', p => p.assets.push(structuredClone(p.assets[0]))],
  ['traversal', p => { p.assets[0].file = '../sprite.png'; }],
  ['frame grid', p => { p.assets[0].frameSize = [3, 2]; }],
  ['frame range', p => { p.assets[0].clips.idle.frames = [1]; }],
  ['duration mismatch', p => { p.assets[0].clips.idle.durationsMs = []; }],
  ['zero duration', p => { p.assets[0].clips.idle.durationsMs = [0]; }],
  ['anchor bounds', p => { p.assets[0].anchors.origin = [3, 0]; }],
  ['unknown palette role', p => { p.assets[0].paletteRoles[1] = 'magic'; }],
  ['missing pilot motions', p => { p.assets[0].kind = 'pilot'; }],
  ['unknown kind', p => { p.assets[0].kind = 'turret-shell'; }],
  ['missing source', p => { p.assets[0].source = 'missing.aseprite'; }],
  ['invalid scale', p => { p.artPixelsPerCell = 0; }],
]) test(name + ' is rejected', () => fixture(({ root, pack, save }) => {
  change(pack); save(); assert.throws(() => validatePack(root));
}));
for (const [name, options] of [['RGBA', { colorType: 6 }], ['partial alpha', { alpha: 128 }]]) {
  test(name + ' is rejected', () => fixture(({ root }) => {
    writeFileSync(join(root, 'sprite.png'), png(options));
    assert.throws(() => validatePack(root));
  }));
}
test('corrupt PNG CRC is rejected', () => fixture(({ root }) => {
  const bytes = png(); bytes[30] ^= 1; writeFileSync(join(root, 'sprite.png'), bytes);
  assert.throws(() => validatePack(root));
}));
test('partial alpha is explicitly allowed for glass, but zero secondary alpha is rejected', () => {
  assert.equal(inspectPng(png({ alpha: 96 }), { allowPartialAlpha: true }).colors, 2);
  assert.throws(() => inspectPng(png({ alpha: 0 }), { allowPartialAlpha: true }));
});
test('glass alpha cannot silently relax ordinary asset rules', () => fixture(({ root, pack, save }) => {
  pack.assets[0].alphaMode = 'glass'; save();
  assert.throws(() => validatePack(root), /cabin-only/);
}));
test('release requires approved metrics and a review tied to exact files', () => fixture(({ root, pack, save }) => {
  assert.throws(() => validatePack(root, { release: true }));
  pack.metricsStatus = 'approved'; save();
  assert.throws(() => validatePack(root, { release: true }));
  const review = { reviewer: 'human-test-fixture', reviewedAt: '2026-09-09',
    digest: digestPack(root, pack),
    checks: { anatomy: true, fixedBody: true, sideView: true, readability: true,
      attachments: true, colors: true, timing: true, coverage: true } };
  writeFileSync(join(root, 'review.json'), JSON.stringify(review));
  assert.equal(validatePack(root, { release: true }).release, true);
  pack.assets[0].clips.idle.durationsMs[0] = 101; save();
  assert.throws(() => validatePack(root, { release: true }), /digest/);
}));

test('weapon pivot and muzzle distance are enforced', () => fixture(({ root, pack, save }) => {
  const a = pack.assets[0]; pack.artPixelsPerCell = 1;
  a.kind = 'weapon'; a.frameSize = [2, 2];
  a.anchors = { weaponPivot: [0, 0], muzzle: [2, 0] };
  a.clips.fire = { frames: [0], durationsMs: [180], loop: false };
  a.clips.wreck = { frames: [0], durationsMs: [1000], loop: true };
  save(); assert.throws(() => validatePack(root), /4 cells/);
}));
test('cabin requires fixed ID and protected face area', () => fixture(({ root, pack, save }) => {
  const a = pack.assets[0]; a.kind = 'cabin';
  a.anchors = { ground: [1, 2], pilotSeat: [1, 1], weaponPivot: [1, 0], damageSmoke: [0, 1] };
  save(); assert.throws(() => validatePack(root), /cabin-standard/);
  a.id = 'cabin-standard'; save(); assert.throws(() => validatePack(root), /4 cells/);
}));
test('animated anchors are checked for names, indices and bounds', () => fixture(({ root, pack, save }) => {
  const a = pack.assets[0]; a.frameAnchors = { 0: { origin: [1, 1] } };
  save(); validatePack(root);
  a.frameAnchors = { 0: { origin: [3, 1] } }; save(); assert.throws(() => validatePack(root), /outside/);
  a.frameAnchors = { 1: { origin: [1, 1] } }; save(); assert.throws(() => validatePack(root), /index/);
  a.frameAnchors = { 0: { newAnchor: [1, 1] } }; save(); assert.throws(() => validatePack(root), /unknown/);
}));
test('loop and one-shot contracts cannot be swapped', () => fixture(({ root, pack, save }) => {
  const a = pack.assets[0]; a.clips.idle.loop = false; save(); assert.throws(() => validatePack(root), /loop/);
  a.clips.idle.loop = true;
  a.clips.destroy = { frames: [0], durationsMs: [600], loop: true };
  save(); assert.throws(() => validatePack(root), /once/);
}));


test('all PNG row filters decode valid indices', () => {
  // Rows [0,1] and [1,0], encoded against the previous row for each filter.
  for (const row of [[0, 1, 0], [1, 1, 255], [2, 1, 255], [3, 1, 255], [4, 1, 255]]) {
    assert.equal(inspectPng(png({ raw: Buffer.from([0, 0, 1, ...row]) })).width, 2);
  }
});
test('transparent-only sheet and invalid palette indices are rejected', () => {
  assert.throws(() => inspectPng(png({ raw: Buffer.from([0, 0, 0, 0, 0, 0]) })), /transparent/);
  assert.throws(() => inspectPng(png({ raw: Buffer.from([0, 0, 2, 0, 0, 0]) })), /palette index/);
});
test('valid cabin and weapon anchors pass; invalid face bounds fail', () => fixture(({ root, pack, save }) => {
  writeFileSync(join(root, 'sprite.png'), png({ width: 8, height: 8 }));
  const a = pack.assets[0]; pack.artPixelsPerCell = 1;
  a.id = 'cabin-standard'; a.kind = 'cabin'; a.frameSize = [8, 8];
  a.anchors = { ground: [4, 8], pilotSeat: [4, 5], weaponPivot: [4, 4], damageSmoke: [0, 5] };
  a.faceSafeArea = [1, 1, 3, 3];
  a.clips.wreck = { frames: [0], durationsMs: [1000], loop: true };
  save(); validatePack(root);
  a.faceSafeArea = [7, 7, 3, 3]; save(); assert.throws(() => validatePack(root), /bounds/);
  a.id = 'weapon-cannon'; a.kind = 'weapon'; a.anchors = { weaponPivot: [0, 4], muzzle: [4, 4] };
  a.clips.fire = { frames: [0], durationsMs: [180], loop: false };
  save(); validatePack(root);
}));
