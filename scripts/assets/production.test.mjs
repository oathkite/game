import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opaqueBounds, placeLandmark, validateCrop, sourceDigest } from './production.mjs';
const rgba=(w,h,points)=>{const b=Buffer.alloc(w*h*4);for(const [x,y]of points)b[(y*w+x)*4+3]=255;return b;};
test('source crop rejects a neighbouring sprite touching the gutter',()=>{
 assert.throws(()=>validateCrop(rgba(8,8,[[0,4],[3,3]]),8,8),/edge/);
 assert.deepEqual(opaqueBounds(rgba(8,8,[[2,3],[5,6]]),8,8),[2,3,4,4]);
});
test('source crop rejects painted background and empty output',()=>{
 assert.throws(()=>validateCrop(Buffer.alloc(64*4,255),8,8),/edge/);
 assert.throws(()=>validateCrop(Buffer.alloc(64*4),8,8),/empty/);
});
test('registration preserves uniform scaling and places source landmark at target',()=>{
 assert.deepEqual(placeLandmark([50,80],[10,20],.2,[60,70]),[52,58]);
});
test('provenance detects changed source bytes',()=>{
 assert.notEqual(sourceDigest(Buffer.from('a')),sourceDigest(Buffer.from('b')));
 assert.match(sourceDigest(Buffer.from('a')),/^[a-f0-9]{64}$/);
});
test('glass mask follows the generated rim and removes exterior glow',async()=>{
 const {rimMask}=await import('./production.mjs');
 const glass=rgba(8,8,[[1,3],[3,3],[6,3]]),rim=rgba(8,8,[[2,3],[5,3]]);
 const out=rimMask(glass,rim,8,8);
 assert.equal(out[(3*8+1)*4+3],0);assert.equal(out[(3*8+3)*4+3],255);assert.equal(out[(3*8+6)*4+3],0);
});
