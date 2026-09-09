import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portraitChecks} from './avatar-checks.mjs';
const make=()=>{
 const m={composition:'integrated',frameCount:12,frameSize:[12,16],foot:[6,14],availability:{scope:'owner-only',grantKey:'kita-personal'},animationStatus:'animated-loop-clips',poses:['neutral','happy','sad'].map((id,frame)=>({id,frame:frame*4,clip:{frames:[0,1,2,3].map(f=>frame*4+f),durations:[100,100,100,100],loop:true}})),layers:[{id:'character'}],metrics:{character:Array.from({length:12},()=>({scale:.4}))}};
 const images=new Map([['character',{width:144,height:16,rgba:new Uint8Array(144*16*4)}]]);
 for(let frame=0;frame<12;frame++)for(let y=2;y<14;y++)for(let x=4;x<8;x++)images.get('character').rgba[(y*144+frame*12+x)*4+3]=255;
 return {m,images};
};
test('integrated portrait checks owner, full sprites and common ground',()=>{
 const {m,images}=make();assert.ok(portraitChecks(m,images).every(c=>c.pass));
 images.get('character').rgba.fill(0);assert.ok(portraitChecks(m,images).some(c=>!c.pass));
});
test('integrated portrait rejects public reservation and separate gear layers',()=>{
 const {m,images}=make();m.availability.scope='public';assert.ok(portraitChecks(m,images).some(c=>!c.pass));
 m.availability.scope='owner-only';m.layers.push({id:'glasses'});assert.ok(portraitChecks(m,images).some(c=>!c.pass));
});

test('animation format rejects missing or non-positive frame durations',()=>{
 const {m,images}=make();m.poses[1].clip.durations[0]=0;
 assert.ok(portraitChecks(m,images).some(c=>!c.pass));
});

test('airborne frame must match its registered height rather than stick to ground',()=>{
 const {m,images}=make();m.metrics.character[1].footLift=5;
 assert.ok(portraitChecks(m,images).some(c=>!c.pass));
});
