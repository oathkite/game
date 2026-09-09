// Mechanical export of generated portrait layers; never generates character shapes.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,utimesSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {insidePolygon,cleanSkinRows} from './avatar-regions.mjs';
import {crc32} from './png.mjs';
import {validateCrop,sourceDigest} from './production.mjs';
const sharp=createRequire(import.meta.url)(process.env.ASSET_SHARP_PATH||'sharp');
const root=resolve('assets/workbench/avatar-kita-v1'),size=[96,112],scale=.20;
const palette=['000000','000000','e4be61','c79736','896b36','fff3da','bbae99','a8d5df','6fa6bc','45677e','293640','ed995b','c47746','764c38','dfd1b7','fffdf1'];
const rgb=palette.map(c=>[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)));
function chunk(type,bytes){const head=Buffer.alloc(8),crc=Buffer.alloc(4);head.writeUInt32BE(bytes.length);head.write(type,4);crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type),bytes])));return Buffer.concat([head,bytes,crc]);}
function indexed(raw,w,h){
 const head=Buffer.alloc(13);head.writeUInt32BE(w);head.writeUInt32BE(h,4);head[8]=8;head[9]=3;
 const rows=Buffer.alloc((w+1)*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const at=(y*w+x)*4;if(raw[at+3]<200)continue;
  let best=1,distance=Infinity;
  // Keep yellow skin shades from alternating with the scarf's orange palette.
  const [r,g,b]=raw.subarray(at,at+3),yellow=r>g*1.05&&r<g*1.45&&g>b*1.3;
  const cloth=insidePolygon(x%size[0]+.5,y+.5,metrics.character[Math.floor(x/size[0])].scarfPolygon);
  for(let k=1;k<rgb.length;k++){if(!cloth&&k>=11&&k<=13)continue;if(yellow&&![2,3,4].includes(k))continue;const d=rgb[k].reduce((sum,c,j)=>sum+(c-raw[at+j])**2,0);if(d<distance){best=k;distance=d;}}
  rows[y*(w+1)+1+x]=best;
 }
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('PLTE',Buffer.from(rgb.flat())),chunk('tRNS',Buffer.from([0,...Array(palette.length-1).fill(255)])),chunk('IDAT',deflateSync(cleanSkinRows(cleanSkinRows(rows,w,h),w,h))),chunk('IEND',Buffer.alloc(0))]);
}
function ora(layer,png,atlasWidth){
 const dir=mkdtempSync(join(tmpdir(),'avatar-'));mkdirSync(join(dir,'data'));writeFileSync(join(dir,'mimetype'),'image/openraster');writeFileSync(join(dir,'data/layer.png'),png);writeFileSync(join(dir,'mergedimage.png'),png);
 writeFileSync(join(dir,'stack.xml'),`<image version="0.0.3" w="${atlasWidth}" h="${size[1]}"><stack><layer name="${layer}" src="data/layer.png" x="0" y="0" opacity="1.0" visibility="visible" composite-op="svg:src-over"/></stack></image>`);
 for(const f of ['mimetype','data/layer.png','mergedimage.png','stack.xml'])utimesSync(join(dir,f),new Date('1980-01-01Z'),new Date('1980-01-01Z'));
 const out=join(root,layer+'.ora');rmSync(out,{force:true});const opts={cwd:dir,env:{...process.env,TZ:'UTC'}};
 execFileSync('zip',['-q','-X','-0',out,'mimetype'],opts);execFileSync('zip',['-q','-X',out,'stack.xml','mergedimage.png','data/layer.png'],opts);rmSync(dir,{recursive:true,force:true});
}
const registration=JSON.parse(readFileSync(join(root,'registration.json'))),frames=[],metrics={character:[]};
for(const entry of registration.frames){
 const frameScale=registration.sourceScales[entry.sheet];
 const bytes=readFileSync(join(root,'generated',entry.sheet+'.png'));
 const [left,top,width,height]=entry.region;
 const {data,info}=await sharp(bytes).extract({left,top,width,height}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const [x,y,w,h]=validateCrop(data,width,height),outSize=[Math.round(w*frameScale),Math.round(h*frameScale)];
 const origin=[Math.round(48+(left+x-entry.sourceFoot[0])*frameScale),Math.round(104+(top+y-entry.sourceFoot[1])*frameScale)-(entry.footLift??0)];
 if(origin.some((v,j)=>v<0||v+outSize[j]>size[j]))throw new Error(entry.sheet+' outside frame');
 const input=await sharp(data,{raw:info}).extract({left:x,top:y,width:w,height:h}).resize(...outSize,{kernel:'nearest'}).png().toBuffer();
 frames.push({input,left:(frames.length)*size[0]+origin[0],top:origin[1]});
 if(!entry.sourceScarf?.length)throw new Error('Missing scarf polygon: '+entry.sheet);
 const scarfPolygon=entry.sourceScarf.map(([px,py])=>[origin[0]+(px-left-x)*outSize[0]/w,origin[1]+(py-top-y)*outSize[1]/h]);
 metrics.character.push({scarfPolygon,region:entry.region,sourceBounds:[left+x,top+y,w,h],outputSize:outSize,outputOrigin:origin,footLift:entry.footLift??0,scale:frameScale,sourceSheet:entry.sheet,sourceHash:sourceDigest(bytes)});
}
const atlasWidth=size[0]*frames.length;
const raw=await sharp({create:{width:atlasWidth,height:size[1],channels:4,background:'#00000000'}}).composite(frames).raw().toBuffer();
const png=indexed(raw,atlasWidth,size[1]);writeFileSync(join(root,'character.png'),png);ora('character',png,atlasWidth);
const manifest={avatarPortraitVersion:2,id:'kita-personal-portraits',status:'draft',availability:{scope:'owner-only',grantKey:'kita-personal'},model:'gpt-image-2.5-sunburst',composition:'integrated',paletteColors:16,outlineColor:'#000000',view:'front-three-quarter-right',frameSize:size,frameCount:frames.length,foot:[48,104],scale,poses:registration.poses,layers:[{id:'character',file:'character.png',source:'character.ora'}],metrics,animationStatus:'animated-loop-clips',humanReview:'pending'};
writeFileSync(join(root,'avatar.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Exported '+frames.length+' integrated animation frames (PNG + ORA).');
