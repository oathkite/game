import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validatePack} from './validate.mjs';
import {inspectPng} from './png.mjs';
import {sourceDigest} from './production.mjs';
import {pixelChecks} from '../../tools/asset-lab/pixel-quality.mjs';
const root=fileURLToPath(new URL('../../assets/workbench/baseline-v2/',import.meta.url));
const pack=JSON.parse(readFileSync(root+'pack.json'));
const images=new Map(pack.assets.map(a=>[a.id,inspectPng(readFileSync(root+a.file),{allowPartialAlpha:a.alphaMode==='glass',pixels:true})]));
const failed=(p=pack,pixels=images)=>pixelChecks(p,pixels).filter(c=>!c.pass);
test('new production pack has complete coverage and remains draft',()=>{
 assert.equal(validatePack(root).assets,29);assert.throws(()=>validatePack(root,{release:true}),/approved/);
 assert.equal(pack.generationModel,'gpt-image-2.5-sunburst');assert.deepEqual(failed(),[]);
 for(const a of pack.assets)assert.deepEqual(a.frameSize,[192,160]);
 const ids=pack.assets.map(a=>a.id);for(const w of ['cannon','triple','multiple','drill','laser','digger','floater','stinger']){
  assert.ok(ids.includes('weapon-'+w));assert.ok(ids.includes('projectile-'+w));
 }
});
test('every export references the exact retained generation',()=>{
 for(const a of pack.assets)for(const m of a.exportMetrics){
  assert.equal(m.sourceHash,sourceDigest(readFileSync(root+'generated/'+m.sourceSheet+'.png')));
  assert.equal(m.sourceRegion.length,4);
 }
});
test('pixel harness rejects floating and eye-covering glasses',()=>{
 const floating=structuredClone(pack);floating.assets.find(a=>a.id==='glasses-blue').anchors.attach[1]+=20;
 assert.ok(failed(floating).some(c=>c.name.includes('頭に接触')));
 const covering=structuredClone(pack);covering.assets.find(a=>a.id==='glasses-blue').anchors.attach[1]-=5;
 assert.ok(failed(covering).some(c=>c.name.includes('目を遮らない')));
});
test('pixel harness rejects missing glass, detached track and wrong muzzle',()=>{
 const missing=new Map(images),cabin=structuredClone(images.get('cabin-standard'));
 const a=pack.assets.find(a=>a.id==='cabin-standard'),f=a.clips['idle-glass'].frames[0];
 for(let y=0;y<160;y++)for(let x=f*192;x<(f+1)*192;x++)cabin.rgba[(y*cabin.width+x)*4+3]=0;
 missing.set('cabin-standard',cabin);assert.ok(failed(pack,missing).some(c=>c.name.includes('ガラス')));
 const moved=structuredClone(pack);moved.assets.find(a=>a.id==='cabin-standard').anchors.ground[1]-=6;
 assert.ok(failed(moved).some(c=>c.name.includes('接地')));
 const muzzle=structuredClone(pack);muzzle.assets.find(a=>a.id==='weapon-cannon').anchors.muzzle[0]+=15;
 assert.ok(failed(muzzle).some(c=>c.name.includes('砲口')));
});
test('pixel harness rejects non-dissipating effect sequence',()=>{
 const stuck=structuredClone(pack);stuck.assets.find(a=>a.id==='effect-explosion').clips.play.frames=[0,1,2,2];
 assert.ok(failed(stuck).some(c=>c.name.includes('消散')));
});

test('pixel harness rejects a neighbouring cyan fragment and glass halo',()=>{
 const stray=new Map(images),effect=structuredClone(images.get('effect-drill'));
 effect.rgba.set([54,217,241,255],(10*effect.width+10)*4);stray.set('effect-drill',effect);
 assert.ok(failed(pack,stray).some(c=>c.name.includes('エネルギー片')));
 const halo=new Map(images),cabin=structuredClone(images.get('cabin-standard'));
 cabin.rgba.set([143,228,246,72],(10*cabin.width+192*2+10)*4);halo.set('cabin-standard',cabin);
 assert.ok(failed(pack,halo).some(c=>c.name.includes('はみ出さない')));
});
test('muzzle flash starts at the emission point instead of inside the barrel',()=>{
 const asset=pack.assets.find(a=>a.id==='effect-muzzle'),image=images.get(asset.id),[w,h]=asset.frameSize;
 for(const frame of [0,1,2]){
  let left=w;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(image.rgba[(y*image.width+frame*w+x)*4+3]>200)left=Math.min(left,x);
  assert.ok(left>=asset.anchors.origin[0]-1&&left<=asset.anchors.origin[0]+1,`frame ${frame}: ${left}`);
 }
});
