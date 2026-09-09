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
 for(const {outputSize:[w,h]} of manifest.metrics.body){
  assert.ok(w>=100&&w<=140,`body width ${w} must stay at approved concept density`);
  assert.ok(h>=140&&h<=184,`body height ${h} must keep compact proportions`);
 }
 assert.equal(manifest.view,'front-three-quarter-right');
 for(const pose of manifest.poses)assert.equal(pose.eyeAreas.length,2);
 for(const layer of ['glasses','scarf']){
  assert.equal(new Set(manifest.metrics[layer].map(m=>m.scale)).size,1);
  for(const {outputSize:[w,h]} of manifest.metrics[layer])assert.ok(w<=96&&h<=52);
 }
});
