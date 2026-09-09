// Mechanical export of generated portrait layers; never generates character shapes.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,utimesSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {crc32} from './png.mjs';
import {validateCrop,sourceDigest} from './production.mjs';
const sharp=createRequire(import.meta.url)(process.env.ASSET_SHARP_PATH||'sharp');
const root=resolve('assets/workbench/avatar-kita-v1'),size=[192,224],scale=.21;
const palette=['000000','202934','414b58','697785','a2a9ad','dfd1b7','fff3da','fffdf1','ffe384','ffc345','c48b2e','8e612a','f1dfbd','bbae99','958b92','685d69','ab9fa4','d9cccb','bff4ff','54d9f1','259abf','196787','ffb478','ed8244','b94c2e','753a29','ffdc57','ff982a','fae9ad','b09978','8fe4f6','fffdf1'];
const rgb=palette.map(c=>[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)));
function chunk(type,bytes){const head=Buffer.alloc(8),crc=Buffer.alloc(4);head.writeUInt32BE(bytes.length);head.write(type,4);crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type),bytes])));return Buffer.concat([head,bytes,crc]);}
function indexed(raw,w,h){
 const head=Buffer.alloc(13);head.writeUInt32BE(w);head.writeUInt32BE(h,4);head[8]=8;head[9]=3;
 const rows=Buffer.alloc((w+1)*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const at=(y*w+x)*4;if(raw[at+3]<200)continue;
  let best=1,distance=Infinity;
  for(let k=1;k<rgb.length;k++){const d=rgb[k].reduce((sum,c,j)=>sum+(c-raw[at+j])**2,0);if(d<distance){best=k;distance=d;}}
  rows[y*(w+1)+1+x]=best;
 }
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('PLTE',Buffer.from(rgb.flat())),chunk('tRNS',Buffer.from([0,...Array(31).fill(255)])),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
function ora(layer,png){
 const dir=mkdtempSync(join(tmpdir(),'avatar-'));mkdirSync(join(dir,'data'));writeFileSync(join(dir,'mimetype'),'image/openraster');writeFileSync(join(dir,'data/layer.png'),png);writeFileSync(join(dir,'mergedimage.png'),png);
 writeFileSync(join(dir,'stack.xml'),`<image version="0.0.3" w="576" h="224"><stack><layer name="${layer}" src="data/layer.png" x="0" y="0" opacity="1.0" visibility="visible" composite-op="svg:src-over"/></stack></image>`);
 for(const f of ['mimetype','data/layer.png','mergedimage.png','stack.xml'])utimesSync(join(dir,f),new Date('1980-01-01Z'),new Date('1980-01-01Z'));
 const out=join(root,layer+'.ora');rmSync(out,{force:true});const opts={cwd:dir,env:{...process.env,TZ:'UTC'}};
 execFileSync('zip',['-q','-X','-0',out,'mimetype'],opts);execFileSync('zip',['-q','-X',out,'stack.xml','mergedimage.png','data/layer.png'],opts);rmSync(dir,{recursive:true,force:true});
}
const registration=JSON.parse(readFileSync(join(root,'registration.json'))),metrics={};
for(const layer of ['body','glasses','scarf']){
 const layerScale=registration.layerScales?.[layer]??scale;
 const sheet=layer==='body'?'poses':layer,bytes=readFileSync(join(root,'generated',sheet+'.png')),frames=[];metrics[layer]=[];
 for(let i=0;i<3;i++){
  const pose=registration.poses[i],r=registration.regions[layer][i], [left,top,width,height]=r;
  const {data,info}=await sharp(bytes).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const [x,y,w,h]=validateCrop(data,width,height),outSize=[Math.round(w*layerScale),Math.round(h*layerScale)];
  const offset=pose.offsets[layer]??[0,0];
  const origin=pose.origins?.[layer]??[Math.round(96+(left+x-pose.sourceFoot[0])*layerScale)+offset[0],Math.round(208+(top+y-pose.sourceFoot[1])*layerScale)+offset[1]];
  if(origin.some((v,j)=>v<0||v+outSize[j]>size[j]))throw new Error(`${layer}/${i} outside frame`);
  const input=await sharp(data,{raw:info}).extract({left:x,top:y,width:w,height:h}).resize(...outSize,{kernel:'nearest'}).png().toBuffer();
  frames.push({input,left:i*size[0]+origin[0],top:origin[1]});metrics[layer].push({region:r,sourceBounds:[left+x,top+y,w,h],outputSize:outSize,outputOrigin:origin,scale:layerScale,sourceHash:sourceDigest(bytes)});
 }
 const raw=await sharp({create:{width:576,height:224,channels:4,background:'#00000000'}}).composite(frames).raw().toBuffer();
 const png=indexed(raw,576,224);writeFileSync(join(root,layer+'.png'),png);ora(layer,png);
}
const manifest={avatarPortraitVersion:1,id:'kita-personal-portraits',status:'draft',availability:{scope:'owner-only',grantKey:'kita-personal'},model:'gpt-image-2.5-sunburst',frameSize:size,foot:[96,208],scale,poses:registration.poses.map((p,i)=>({id:p.id,label:p.label,frame:i,faceArea:p.faceArea,eyeAreas:p.eyeAreas,headAnchor:p.headAnchor,neckAnchor:p.neckAnchor})),layers:['body','scarf','glasses'].map(id=>({id,file:id+'.png',source:id+'.ora'})),metrics,animationStatus:'representative-still-poses-only',humanReview:'pending'};
writeFileSync(join(root,'avatar.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Exported 3 poses × 3 independent layers (PNG + ORA).');
