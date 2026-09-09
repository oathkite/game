import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containSize, previewGeometry } from './geometry.mjs';
test('wide tracks are not flattened and tall characters are not stretched', () => {
  assert.deepEqual(containSize(280, 112, 80, 32), { width: 80, height: 32 });
  assert.deepEqual(containSize(200, 250, 35, 44), { width: 35, height: 44 });
  assert.deepEqual(containSize(240, 160, 84, 63), { width: 84, height: 56 });
});
test('preview uses device resolution and integer sprite pixels', () => {
  for (const dpr of [1, 1.25, 2, 3]) for (const w of [358, 779.5, 1000]) {
    const g = previewGeometry(w, w * .52, dpr);
    assert.equal(g.width, Math.round(w * dpr));
    assert.ok(Number.isInteger(g.scale));
    assert.ok(Number.isInteger(g.x));
    assert.ok(Number.isInteger(g.y));
  }
});
