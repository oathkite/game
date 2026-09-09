import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portraitFrame} from './avatar-timing.mjs';
test('animation advances at exact boundaries and repeats after complete duration',()=>{
 const clip={frames:[4,5,6,7],durations:[200,100,300,100]};
 assert.equal(portraitFrame(clip,0),4);
 assert.equal(portraitFrame(clip,199),4);
 assert.equal(portraitFrame(clip,200),5);
 assert.equal(portraitFrame(clip,600),7);
 assert.equal(portraitFrame(clip,700),4);
 assert.equal(portraitFrame(clip,1600),5);
});
