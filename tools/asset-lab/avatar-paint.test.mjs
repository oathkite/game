import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectPng} from '../../scripts/assets/png.mjs';
import {paintAvatar,defaultSkinColor} from './avatar-paint.mjs';
test('all 12 frames recolor only skin while preserving fixed colors, alpha and source',()=>{
 const image=inspectPng(readFileSync('assets/workbench/avatar-kita-v1/character.png'),{pixels:true});
 const source=new Uint8ClampedArray(image.rgba),before=source.slice();
 assert.deepEqual(paintAvatar(source,defaultSkinColor),source);
 for(const color of ['#65b878','#519ad1','#dd74ad','#ffffff','#000000']){
  const result=paintAvatar(source,color),changed=Array(12).fill(0);
  for(let i=0;i<source.length;i+=4){
   const skin=source[i+3]===255&&['228,190,97','199,151,54','137,107,54'].includes([...source.slice(i,i+3)].join(','));
   if(skin){assert.notDeepEqual(result.slice(i,i+3),source.slice(i,i+3));changed[Math.floor((i/4%image.width)/96)]++;}
   else assert.deepEqual(result.slice(i,i+4),source.slice(i,i+4));
   assert.equal(result[i+3],source[i+3]);
  }
  assert.ok(changed.every(n=>n>0));
 }
 assert.deepEqual(source,before);
});
test('scarf recoloring is independent of skin and preserves all other pixels',()=>{
 const image=inspectPng(readFileSync('assets/workbench/avatar-kita-v1/character.png'),{pixels:true});
 const source=new Uint8ClampedArray(image.rgba);
 for(const skin of [defaultSkinColor,'#65b878']){
  const before=paintAvatar(source,skin),after=paintAvatar(source,skin,'#4867d5'),counts=Array(12).fill(0);
  for(let i=0;i<source.length;i+=4){
   const scarf=source[i+3]===255&&['237,153,91','196,119,70','118,76,56'].includes([...source.slice(i,i+3)].join(','));
   if(scarf){assert.notDeepEqual(after.slice(i,i+3),before.slice(i,i+3));counts[Math.floor((i/4%image.width)/96)]++;}
   else assert.deepEqual(after.slice(i,i+4),before.slice(i,i+4));
  }
  assert.ok(counts.every(n=>n>0));
 }
});
