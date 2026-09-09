import {test} from 'node:test';import assert from 'node:assert/strict';
import {insidePolygon,cleanSkinRows} from './avatar-regions.mjs';
test('cloth polygon excludes hands beside the scarf bow',()=>{
 const polygon=[[1,1],[9,1],[9,3],[6,3],[6,6],[4,6],[4,3],[1,3]];
 assert.equal(insidePolygon(5,5,polygon),true);assert.equal(insidePolygon(2,5,polygon),false);
});
test('skin cleanup removes isolated palette speckles without touching cloth or contour',()=>{
 const width=7,height=7,stride=8,rows=Buffer.alloc(stride*height);
 for(let y=1;y<6;y++)for(let x=1;x<6;x++)rows[y*stride+x+1]=2;
 rows[3*stride+4]=4;const before=Buffer.from(rows);
 assert.equal(cleanSkinRows(rows,width,height)[3*stride+4],2);assert.deepEqual(rows,before);
 for(const fixed of [0,1,5,11,12,13]){rows[3*stride+4]=fixed;assert.equal(cleanSkinRows(rows,width,height)[3*stride+4],fixed);}
});
