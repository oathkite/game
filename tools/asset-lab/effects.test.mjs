import {test} from 'node:test';
import assert from 'node:assert/strict';
import {effectInstances} from './effects.mjs';
import {poseAt} from './animation.mjs';
const cabin={anchors:{ground:[96,144],damageSmoke:[30,95]}};
const at=(state,time,hp=100)=>effectInstances(poseAt(state,time,hp),cabin);
test('damage smoke uses three staggered rising plumes and persists during low-HP fire',()=>{
 for(const state of ['low-hp','fire']){
  const smoke=at(state,200,20).filter(e=>e.id==='effect-smoke');
  assert.equal(smoke.length,3);assert.equal(new Set(smoke.map(e=>e.time)).size,3);
  assert.ok(smoke.every(e=>e.point[1]<=95&&e.alpha>0&&e.alpha<=.8));
 }
 assert.equal(at('wreck',200,0).filter(e=>e.id==='effect-smoke').length,4);
 assert.equal(at('idle',200).length,0);
});
test('destruction spreads three bursts over the hull and stops on wreck transition',()=>{
 const bursts=at('destroy',200).filter(e=>e.id==='effect-explosion');
 assert.equal(bursts.length,3);assert.ok(Math.max(...bursts.map(e=>e.point[0]))-Math.min(...bursts.map(e=>e.point[0]))>=40);
 assert.equal(at('destroy',600).filter(e=>e.id==='effect-explosion').length,0);
 assert.ok(at('destroy',599).filter(e=>e.id==='effect-explosion').every(e=>e.alpha<.02));
});
test('landing dust spans both track edges, fades and runs after a fall',()=>{
 const dust=at('land',100);assert.equal(dust.length,3);
 assert.ok(dust.every(e=>e.id==='effect-dust'&&e.point[1]===144));
 assert.ok(dust[0].point[0]<=60&&dust[2].point[0]>110);
 assert.deepEqual(at('fall',900),dust);
 assert.ok(at('land',449).every(e=>e.alpha<.02));assert.equal(at('land',450).length,0);
});
