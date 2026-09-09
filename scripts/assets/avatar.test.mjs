import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateAvatar} from './validate-avatar.mjs';
test('delivered portrait layers pass format, source and composition checks',()=>{
 const report=validateAvatar();assert.deepEqual(report.failed,[]);assert.equal(report.humanReview,'pending');
});

test('portrait keeps coarse pixel density and black outline with visible eyes in three-quarter view',async()=>{
 const {readFileSync}=await import('node:fs');
 const manifest=JSON.parse(readFileSync('assets/workbench/avatar-kita-v1/avatar.json'));
 assert.deepEqual(manifest.frameSize,[96,112]);
 for(const {outputSize:[w,h]} of manifest.metrics.character){
  assert.ok(w>=35&&w<=85,`body width ${w} must stay at approved concept density`);
  assert.ok(h>=35&&h<=104,`body height ${h} must keep compact proportions`);
 }
 assert.equal(manifest.view,'front-three-quarter-right');
 assert.equal(manifest.composition,'integrated');
 assert.equal(manifest.frameCount,12);
 assert.equal(manifest.paletteColors,16);
 assert.equal(manifest.outlineColor,'#000000');
 assert.ok(manifest.metrics.character.slice(4,8).some(m=>m.footLift>0));
 assert.equal(manifest.poses.find(p=>p.id==='sad').action,'seated-disappointment');
 assert.equal(manifest.animationStatus,'animated-loop-clips');
 assert.deepEqual(manifest.layers.map(l=>l.id),['character']);
});

test('exported PNG keeps 16 colors and restrained black area in every frame',async()=>{
 const {readFileSync}=await import('node:fs'),{inspectPng}=await import('./png.mjs');
 const image=inspectPng(readFileSync('assets/workbench/avatar-kita-v1/character.png'),{pixels:true});
 const manifest=JSON.parse(readFileSync('assets/workbench/avatar-kita-v1/avatar.json'));
 assert.ok(image.colors<=16);
 const [w,h]=manifest.frameSize;
 for(let frame=0;frame<manifest.frameCount;frame++){
  let opaque=0,black=0,boundary=0;
  for(let y=0;y<h;y++)for(let x=frame*w;x<(frame+1)*w;x++){
   const i=(y*image.width+x)*4;if(!image.rgba[i+3])continue;
   opaque++;
   if([i-4,i+4,i-image.width*4,i+image.width*4].some(j=>!image.rgba[j+3]))boundary++;
   if(image.rgba[i]===0&&image.rgba[i+1]===0&&image.rgba[i+2]===0)black++;
  }
  // Area shrinks with a slimmer body; also normalize black detail by silhouette length.
  assert.ok(opaque>0&&black/opaque>=.03&&black/opaque<=.18&&black/boundary<=1.8,
   'KITA frame '+frame+' must retain black detail without the previous heavy outline');
 }
});

test('scarf palette stays inside its registered cloth region in every frame',async()=>{
 const {readFileSync}=await import('node:fs'),{inspectPng}=await import('./png.mjs');
 const {insidePolygon}=await import('./avatar-regions.mjs');
 const manifest=JSON.parse(readFileSync('assets/workbench/avatar-kita-v1/avatar.json'));
 const image=inspectPng(readFileSync('assets/workbench/avatar-kita-v1/character.png'),{pixels:true});
 const scarf=new Set(['237,153,91','196,119,70','118,76,56']);
 for(let f=0;f<12;f++){
  const polygon=manifest.metrics.character[f].scarfPolygon;
  assert.ok(polygon?.length>=3,'scarf region required for frame '+f);
  let count=0;
  for(let y=0;y<112;y++)for(let x=0;x<96;x++){
   const i=(y*image.width+f*96+x)*4;
   if(image.rgba[i+3]&&scarf.has([...image.rgba.slice(i,i+3)].join(','))){
    assert.ok(insidePolygon(x+.5,y+.5,polygon),'scarf leaked outside cloth in frame '+f);count++;
   }
  }
  assert.ok(count>10,'scarf must not be erased to pass isolation');
 }
});
