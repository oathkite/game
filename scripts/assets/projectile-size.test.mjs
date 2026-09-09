import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const pack=JSON.parse(readFileSync(new URL('../../assets/workbench/baseline-v2/pack.json',import.meta.url)));
test('single-shot ammunition stays readable relative to the 60px weapon',()=>{
 for(const id of ['cannon','drill','laser','digger','floater','stinger']){
  const ammo=pack.assets.find(a=>a.id==='projectile-'+id).exportMetrics[0];
  const gun=pack.assets.find(a=>a.id==='weapon-'+id).exportMetrics[0];
  assert.ok(ammo.outputSize[0]>=gun.outputSize[0]*.3,id+' too short');
  assert.ok(ammo.outputSize[1]>=(id==='laser'?4:7),id+' too thin');
  assert.ok(ammo.outputSize[0]<=gun.outputSize[0]*.6,id+' too large');
  assert.ok(Math.abs(ammo.outputSize[0]/ammo.sourceSize[0]-ammo.outputSize[1]/ammo.sourceSize[1])<.02,id+' distorted');
 }
});
test('approved triple and multiple ammunition retain their size',()=>{
 for(const [id,size]of [['triple',[9,4]],['multiple',[6,6]]])assert.deepEqual(pack.assets.find(a=>a.id==='projectile-'+id).exportMetrics[0].outputSize,size);
});

test('revised bomb is dark and laser contains light without metal casing',async()=>{
 const {inspectPng}=await import('./png.mjs');
 const pixels=id=>{
  const asset=pack.assets.find(a=>a.id===id);
  const image=inspectPng(readFileSync(new URL('../../assets/workbench/baseline-v2/'+asset.file,import.meta.url)),{pixels:true});
  return Array.from({length:image.rgba.length/4},(_,i)=>[...image.rgba.slice(i*4,i*4+4)]).filter(p=>p[3]>200);
 };
 const bomb=pixels('projectile-digger');assert.ok(bomb.filter(([r,g,b])=>Math.max(r,g,b)<130).length/bomb.length>.7);
 const light=pixels('projectile-laser');assert.ok(light.every(([r,g,b])=>g>120&&b>150));
 const bombSize=pack.assets.find(a=>a.id==='projectile-digger').exportMetrics[0].outputSize;
 assert.ok(bombSize[1]>=bombSize[0],'round bomb with fuse, not long shell');
});
test('tank VFX retain sufficient source-frame size before multi-emitter composition',()=>{
 for(const [id,minWidth,minHeight]of [['explosion',100,80],['smoke',60,35],['dust',70,40]]){
  const frames=pack.assets.find(a=>a.id==='effect-'+id).exportMetrics;
  assert.ok(frames.some(m=>m.outputSize[0]>=minWidth&&m.outputSize[1]>=minHeight),id+' too small');
 }
});
