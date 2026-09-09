import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanPaint} from './paint-cleanup.mjs';
const make=()=>new Uint8Array(25).fill(12);
test('removes isolated paint shades inside a flat painted surface',()=>{
 const pixels=make();pixels[12]=26;
 const out=cleanPaint(pixels,5,5,'cabin');assert.equal(out[12],12);assert.equal(pixels[12],26);
});
test('preserves contours, accent details, glass and non-machine assets',()=>{
 for(const index of [0,1,22,30,31]){
  const pixels=make();pixels[12]=index;assert.equal(cleanPaint(pixels,5,5,'cabin')[12],index);
 }
 const edge=make();edge[12]=26;edge[7]=0;assert.equal(cleanPaint(edge,5,5,'weapon')[12],26);
 const pilot=make();pilot[12]=26;assert.deepEqual(cleanPaint(pilot,5,5,'pilot'),pilot);
});
test('retains continuous paint highlights',()=>{
 const pixels=make();pixels[7]=26;pixels[12]=26;pixels[17]=26;
 assert.deepEqual(cleanPaint(pixels,5,5,'cabin'),pixels);
});
test('hull panel cleanup flattens mottling without painting over bolts',()=>{
 const pixels=new Uint8Array(384*160).fill(12),at=101*384+192+70;
 pixels[at]=26;pixels[at+4]=22;
 const clean=cleanPaint(pixels,384,160,'cabin',192,160);
 assert.equal(clean[at],12);assert.equal(clean[at+4],22);
});
