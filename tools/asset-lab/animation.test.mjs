import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipFrame, poseAt, STATES, runChecks } from './animation.mjs';
const clip = { frames: [2, 7], durationsMs: [100, 200], loop: true };
test('frame boundaries and looping use duration, not refresh rate', () => {
  assert.equal(clipFrame(clip, 99), 2);
  assert.equal(clipFrame(clip, 100), 7);
  assert.equal(clipFrame(clip, 300), 2);
  assert.equal(clipFrame({ ...clip, loop: false }, 999), 7);
});
test('destroy reaches wreck once and never restarts explosion', () => {
  assert.equal(poseAt('destroy', 200, 0).state, 'destroy');
  assert.equal(poseAt('destroy', 1200, 0).state, 'wreck');
  assert.equal(poseAt('destroy', 9000, 0).explosion, -1);
});
test('temporary hit/fire recover to low HP and keep smoke during reaction', () => {
  assert.equal(poseAt('fire', 20, 20).smoke, true);
  assert.equal(poseAt('hit', 900, 20).state, 'low-hp');
  assert.equal(poseAt('fire', 1500, 100).state, 'idle');
});
test('states all have finite transforms and expected clip names', () => {
  for (const state of Object.keys(STATES)) for (const ms of [0, 70, 190, 599, 900, 4000]) {
    const pose = poseAt(state, ms, 100);
    assert.ok(Number.isFinite(pose.bodyY));
    assert.ok(Number.isFinite(pose.recoil));
    assert.ok(STATES[pose.state]);
  }
});
test('frame coverage check fails if required pilot animation is missing', () => {
  const result = runChecks({ assets: [{ id: 'pilot-frog', clips: {} }] });
  assert.ok(result.some(r => !r.pass));
});
test('fall moves downward, lands, and starts the landing clip at zero', () => {
  assert.ok(poseAt('fall', 0).airborne < poseAt('fall', 400).airborne);
  assert.equal(poseAt('fall', 800).state, 'land');
  assert.equal(poseAt('fall', 800).clipTime, 0);
  assert.equal(poseAt('fall', 1250).state, 'idle');
});
test('new state has its own clock instead of inheriting previous clip time', () => {
  assert.equal(poseAt('destroy', 600, 0).clipTime, 0);
  assert.equal(poseAt('hit', 500, 20).clipTime, 0);
});

test('wreck sinks the assembled body while keeping the tracks grounded', () => {
  for (const [state, time] of [['wreck', 0], ['destroy', 600], ['wreck', 10000]]) {
    const pose = poseAt(state, time, 0);
    assert.equal(pose.bodyY, 8);
    assert.equal(pose.airborne, 0);
  }
  assert.equal(poseAt('idle', 0, 100).bodyY, 0);
});

test('body recoil follows single and repeated shots and returns to rest', async () => {
  const { firingMotion } = await import('./animation.mjs');
  assert.equal(firingMotion('cannon', poseAt('fire', 90)).bodyX, -2);
  assert.equal(firingMotion('cannon', poseAt('fire', 180)).bodyX, 0);
  assert.equal(firingMotion('multiple', poseAt('fire', 450)).bodyX, -2);
  assert.equal(firingMotion('multiple', poseAt('fire', 700)).bodyX, 0);
  assert.equal(firingMotion('cannon', poseAt('wreck', 90)).bodyX, 0);
});
