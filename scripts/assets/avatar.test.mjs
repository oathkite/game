import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAvatar} from './validate-avatar.mjs';
test('delivered portrait layers pass format, source and composition checks',()=>{
 const report=validateAvatar();assert.deepEqual(report.failed,[]);assert.equal(report.humanReview,'pending');
});

test('portrait keeps game-scale body and exact game accessory resolution',async()=>{
 const {readFileSync}=await import('node:fs');
 const manifest=JSON.parse(readFileSync('assets/workbench/avatar-kita-v1/avatar.json'));
 assert.deepEqual(manifest.frameSize,[64,64]);
 for(const {outputSize:[w,h]} of manifest.metrics.body){
  assert.ok(w>=25&&w<=35,`body width ${w} must stay at game pixel density`);
  assert.ok(h>=35&&h<=46,`body height ${h} must keep compact proportions`);
 }
 for(const m of manifest.metrics.glasses)assert.deepEqual(m.outputSize,[13,7]);
 for(const m of manifest.metrics.scarf)assert.deepEqual(m.outputSize,[15,7]);
});
