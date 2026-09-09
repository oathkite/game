import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paintRoles,paintTone,recolor} from './paint.mjs';
test('all yellow and beige chassis shades belong to primary paint',()=>{
 const roles=paintRoles('cabin',32);
 for(const i of [5,6,7,8,9,10,11,12,13,26,27,28,29])assert.match(roles[i],/^primary-/);
 for(const i of [1,2,3,4,14,15,16,17,18,19,20,21,30,31])assert.equal(roles[i],'fixed');
 for(const i of [22,23,24,25])assert.match(roles[i],/^secondary-/);
});
test('red and black paint keep highlights neutral instead of leaving yellow',()=>{
 for(const i of [5,6,7,8,9,10,11,12,13,26,27,28,29]){
  const red=recolor('#ff0000',paintTone(i));assert.equal(red[1],red[2]);
  const black=recolor('#000000',paintTone(i));assert.equal(black[0],black[1]);assert.equal(black[1],black[2]);
 }
 assert.ok(recolor('#000000',paintTone(7))[0]>0);
});
test('pilot, accessories and VFX never inherit machine paint roles',()=>{
 for(const kind of ['pilot','accessory','effect','projectile'])assert.ok(paintRoles(kind,32).slice(1).every(r=>r==='fixed'));
});
test('export gate rejects unassigned highlight or beige and invalid tone',async()=>{
 const {readFileSync}=await import('node:fs'),{validPaint}=await import('./paint.mjs');
 const pack=JSON.parse(readFileSync(new URL('../../assets/workbench/baseline-v2/pack.json',import.meta.url)));
 assert.ok(pack.assets.every(validPaint));
 const cabin=pack.assets.find(a=>a.kind==='cabin');
 for(const index of [7,12,26,28]){
  const broken=structuredClone(cabin);broken.paletteRoles[index]='fixed';assert.equal(validPaint(broken),false);
 }
 const broken=structuredClone(cabin);broken.paletteTones[7]=2;assert.equal(validPaint(broken),false);
});
