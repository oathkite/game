import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAvatar} from './validate-avatar.mjs';
test('delivered portrait layers pass format, source and composition checks',()=>{
 const report=validateAvatar();assert.deepEqual(report.failed,[]);assert.equal(report.humanReview,'pending');
});

test('portrait keeps approved concept density and compact proportions with visible eyes in three-quarter view',async()=>{
 const {readFileSync}=await import('node:fs');
 const manifest=JSON.parse(readFileSync('assets/workbench/avatar-kita-v1/avatar.json'));
 assert.deepEqual(manifest.frameSize,[192,224]);
 for(const {outputSize:[w,h]} of manifest.metrics.character){
  assert.ok(w>=100&&w<=140,`body width ${w} must stay at approved concept density`);
  assert.ok(h>=140&&h<=184,`body height ${h} must keep compact proportions`);
 }
 assert.equal(manifest.view,'front-three-quarter-right');
 assert.equal(manifest.composition,'integrated');
 assert.equal(manifest.frameCount,12);
 assert.equal(manifest.animationStatus,'animated-loop-clips');
 assert.deepEqual(manifest.layers.map(l=>l.id),['character']);
});
