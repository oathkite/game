import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portraitChecks} from './avatar-checks.mjs';
const make=()=>{
 const m={avatarPortraitVersion:1,frameSize:[12,16],foot:[6,14],availability:{scope:'owner-only',grantKey:'kita-personal'},animationStatus:'representative-still-poses-only',poses:['neutral','happy','sad'].map((id,i)=>({id,frame:i,faceArea:[5,4,2,2]})),layers:['body','scarf','glasses'].map(id=>({id})),metrics:{body:[{scale:.21},{scale:.21},{scale:.21}]}};
 const images=new Map(m.layers.map(l=>[l.id,{width:36,height:16,rgba:new Uint8Array(36*16*4)}]));
 for(let frame=0;frame<3;frame++)for(let y=2;y<14;y++)for(let x=4;x<8;x++)images.get('body').rgba[(y*36+frame*12+x)*4+3]=255;
 for(let frame=0;frame<3;frame++)for(const [id,y]of [['glasses',3],['scarf',8]])images.get(id).rgba[(y*36+frame*12+5)*4+3]=255;
 return {m,images};
};
test('portrait gate checks all poses, owner scope and accessory contact',()=>{
 const {m,images}=make();assert.ok(portraitChecks(m,images).every(c=>c.pass));
 images.get('glasses').rgba.fill(0);assert.ok(portraitChecks(m,images).some(c=>!c.pass));
});
test('portrait gate rejects public reservation and gear hiding natural eyes',()=>{
 const {m,images}=make();m.availability.scope='public';assert.ok(portraitChecks(m,images).some(c=>!c.pass));
 m.availability.scope='owner-only';images.get('glasses').rgba[(4*36+5)*4+3]=255;
 assert.ok(portraitChecks(m,images).some(c=>!c.pass));
});
