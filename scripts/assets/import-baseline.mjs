// Mechanical export of imagegen frames: crop, nearest resize, palette indexing and OpenRaster packaging.
// Re-run with ASSET_SHARP_PATH pointing to an installed sharp package if it is not resolvable locally.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { crc32 } from './png.mjs';
const require = createRequire(import.meta.url);
const sharp = require(process.env.ASSET_SHARP_PATH || 'sharp');
const root = resolve('assets/workbench/baseline-v1');
const palette = ['000000','142039','354358','657183','929ca8','cbd1cf','fff8df','fffdf5','f3ce39','e4af1c','b78320',
  '92e0b4','6bbd97','40856d','cbc3ef','a19ac9','736b9c','64d9ef','279ac7','16709d','ffe78a','fdbb40','f68b29','ce5b26','f6a553','ed8039','a94b28'];
const rgb = palette.map(c => [0,2,4].map(i => parseInt(c.slice(i,i+2),16)));
const exportInfo = new WeakMap();
const roles = palette.map((_, i) => i === 0 ? 'transparent' : i >= 11 && i <= 13 ? ['primary-light','primary-mid','primary-dark'][i-11] :
  i >= 14 && i <= 16 ? ['secondary-light','secondary-mid','secondary-dark'][i-14] : 'fixed');
function chunk(type, bytes) {
  const header = Buffer.alloc(8), crc = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length); header.write(type, 4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), bytes])));
  return Buffer.concat([header, bytes, crc]);
}
function encode(raw, width, height, glass=false) {
  const h = Buffer.alloc(13); h.writeUInt32BE(width); h.writeUInt32BE(height,4); h[8]=8; h[9]=3;
  const rows = Buffer.alloc((width+1)*height);
  for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const at=(y*width+x)*4;
    const glassPixel=glass && Math.floor(x/128)===2 && y<128;
    if(raw[at+3]<(glassPixel?16:160)) continue;
    if(glassPixel && raw[at+3]<160){
      rows[y*(width+1)+1+x]=raw[at]>200&&raw[at+1]>200?28:27;continue;
    }
    let best=1, distance=Infinity;
    for(let k=1;k<rgb.length;k++) {
      const d=rgb[k].reduce((sum,c,j)=>sum+(c-raw[at+j])**2,0);
      if(d<distance){best=k;distance=d;}
    }
    rows[y*(width+1)+1+x]=best;
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',h),chunk('PLTE',Buffer.from(glass?[...rgb.flat(),100,217,239,255,253,245]:rgb.flat())),
    chunk('tRNS',Buffer.from(glass?[0,...Array(26).fill(255),64,112]:[0])),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
async function cell(sheet, index, box) {
  const file=join(root,'generated',sheet+'.png');
  const {width,height,hasAlpha}=await sharp(file).metadata();
  if(!hasAlpha)throw new Error(sheet+' requires genuine alpha; a checkerboard is not transparency');
  const x=Math.floor(index%4*width/4)+(box?.[2]??0), x2=Math.floor((index%4+1)*width/4)-(box?.[3]??0);
  const y=box?.[0]??Math.floor(Math.floor(index/4)*height/4);
  const bottom=box?y+box[1]:Math.floor((Math.floor(index/4)+1)*height/4);
  const {data,info}=await sharp(file).extract({left:x,top:y,width:x2-x,height:bottom-y}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let minX=info.width,minY=info.height,maxX=0,maxY=0;
  for(let yy=0;yy<info.height;yy++)for(let xx=0;xx<info.width;xx++)if(data[(yy*info.width+xx)*4+3]>200){
    if(xx===0||yy===0||xx===info.width-1||yy===info.height-1)throw new Error(`${sheet} frame ${index}: opaque pixel on source crop edge; fix cell bounds before export`);
    minX=Math.min(minX,xx);minY=Math.min(minY,yy);maxX=Math.max(maxX,xx);maxY=Math.max(maxY,yy);
  }
  return {bytes:await sharp(data,{raw:info}).extract({left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}).png().toBuffer(),
    width:maxX-minX+1,height:maxY-minY+1,sourceOrigin:[x+minX,y+minY]};
}
async function frame(sheet,index,target,box,options={}) {
  const [left,top,width,height]=target, source=options.source ?? await cell(sheet,index,box);
  const scale=options.scale ?? Math.min(width/source.width,height/source.height);
  const size={width:Math.max(1,Math.round(source.width*scale)),height:Math.max(1,Math.round(source.height*scale))};
  const part=await sharp(source.bytes).resize(size.width,size.height,{kernel:'nearest'}).png().toBuffer();
  const x=left+Math.floor((width-size.width)/2), y=top+(options.center?Math.floor((height-size.height)/2):height-size.height);
  const raw=await sharp({create:{width:128,height:128,channels:4,background:'#00000000'}}).composite([{input:part,left:x,top:y}]).raw().toBuffer();
  if(options.glass)for(let i=3;i<raw.length;i+=4)raw[i]=Math.round(raw[i]*.4);
  exportInfo.set(raw,{sourceSheet:sheet,sourceFrame:index,sourceSize:[source.width,source.height],sourceOrigin:source.sourceOrigin,
    outputSize:[size.width,size.height],outputOrigin:[x,y],scale,group:options.group ?? null});
  return raw;
}
async function frameGroup(sheet,indices,target,boxes,center=false,offsets={}) {
  const sources=await Promise.all(indices.map(i=>cell(sheet,i,boxes?.(i))));
  const scale=Math.min(target[2]/Math.max(...sources.map(s=>s.width)),target[3]/Math.max(...sources.map(s=>s.height)));
  return Promise.all(indices.map((i,n)=>frame(sheet,i,[target[0]+(offsets[i]??0),...target.slice(1)],boxes?.(i),{source:sources[n],scale,center,group:sheet+'-'+indices.join('-')})));
}
function landmark(frame,point) {
  const meta=exportInfo.get(frame);
  return point.map((v,i)=>Math.round(meta.outputOrigin[i]+(v-meta.sourceOrigin[i])*meta.scale));
}
function ora(id,png,width,height) {
  const dir=mkdtempSync(join(tmpdir(),'fortress-ora-'));mkdirSync(join(dir,'data'));
  writeFileSync(join(dir,'mimetype'),'image/openraster');writeFileSync(join(dir,'data/layer.png'),png);
  writeFileSync(join(dir,'mergedimage.png'),png);
  writeFileSync(join(dir,'stack.xml'),`<?xml version="1.0" encoding="UTF-8"?><image version="0.0.3" w="${width}" h="${height}" name="${id}"><stack><layer name="${id} indexed frames" src="data/layer.png" x="0" y="0" opacity="1.0" visibility="visible" composite-op="svg:src-over"/></stack></image>`);
  const out=join(root,id+'.ora');rmSync(out,{force:true});
  execFileSync('zip',['-q','-0',out,'mimetype'],{cwd:dir});execFileSync('zip',['-q',out,'stack.xml','mergedimage.png','data/layer.png'],{cwd:dir});
  rmSync(dir,{recursive:true,force:true});
}
const assets=[];
async function asset(id,kind,frames,anchors,clips,extra={}) {
  const columns=Math.min(4,frames.length), rows=Math.ceil(frames.length/columns), width=128*columns,height=128*rows;
  const layers=frames.map((data,i)=>({input:data,raw:{width:128,height:128,channels:4},left:i%columns*128,top:Math.floor(i/columns)*128}));
  const raw=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite(layers).raw().toBuffer();
  const png=encode(raw,width,height,extra.alphaMode==='glass');writeFileSync(join(root,id+'.png'),png);ora(id,png,width,height);
  const paletteRoles=roles.map((role,i)=>i===0?'transparent':kind==='pilot'?(i>=8&&i<=10?'pilot':'fixed'):kind==='accessory'?(i>=17?'accessory':'fixed'):role);
  if(extra.alphaMode==='glass')paletteRoles.push('fixed','fixed');
  assets.push({id,kind,file:id+'.png',source:id+'.ora',frameSize:[128,128],paletteRoles,anchors,clips,exportMetrics:frames.map(f=>exportInfo.get(f)),...extra});
}
const clip=(frames,durationsMs,loop=true)=>({frames,durationsMs,loop});
const one=(index=0)=>clip([index],[1000]);
const pilotFrames=await frameGroup('pilot',Array.from({length:16},(_,i)=>i),[26,34,27,34],undefined,false,{6:7});
// Source-sheet landmarks: forehead above the natural eye, and neck. Never infer either from the white belly.
const landmarks=[
 [[185,60],[191,156]],[[495,60],[502,157]],[[800,60],[811,151]],[[1140,80],[1156,147]],
 [[210,365],[225,470]],[[499,375],[515,476]],[[751,360],[785,475]],[[1139,363],[1154,474]],
 [[195,658],[207,759]],[[501,660],[514,768]],[[812,663],[834,767]],[[1147,677],[1175,780]],
 [[200,979],[218,1040]],[[505,976],[516,1050]],[[827,967],[845,1046]],[[1178,1027],[1164,1079]],
];
const frameAnchors=Object.fromEntries(pilotFrames.map((f,i)=>[i,{headAnchor:landmark(f,landmarks[i][0]),neckAnchor:landmark(f,landmarks[i][1])}]));
await asset('pilot-frog','pilot',pilotFrames,{pilotSeat:[64,76],...frameAnchors[0]}, {
  idle:clip([0,1,2,0],[500,500,100,100]),move:clip([3,4],[100,100]),fire:clip([5,6,0],[60,100,20],false),
  hit:clip([7,8,0],[100,100,200],false),'low-hp':clip([9,10,9],[600,300,700]),fall:one(11),land:clip([12,0],[150,30],false),
  destroy:clip([7,13,14],[120,330,150],false),wreck:one(15),
},{frameAnchors,frameFaceAreas:Object.fromEntries(Object.entries(frameAnchors).map(([i,a])=>[i,[a.headAnchor[0],a.headAnchor[1]+2,4,6]]))});
const moduleBox=i=>i===0?[140,220,0,-12]:i===1?[140,220,20,10]:[[140,220],[450,190],[700,230],[980,240]][Math.floor(i/4)];
const moduleFrame=(i,rect,center=false)=>frame('modules',i,rect,moduleBox(i),{center});
await asset('cabin-standard','cabin',[await moduleFrame(0,[12,40,88,44]),await moduleFrame(1,[12,3,84,63]),await frame('modules-gloss',1,[12,3,84,63],moduleBox(1),{glass:true})],
 {ground:[64,104],pilotSeat:[64,76],weaponPivot:[64,72],damageSmoke:[33,73]},
 {idle:one(),wreck:one(),'idle-front':one(1),'wreck-front':one(1),'idle-glass':one(2)},{alphaMode:'glass',faceSafeArea:[38,34,13,18]});
await asset('tracks-standard','undercarriage',await frameGroup('modules',[2,3,14],[14,60,96,44],moduleBox),
 {ground:[64,104],cabinMount:[64,78],exhaust:[28,87]},{idle:one(),move:clip([0,1],[90,90]),wreck:one(2)});
const weapons=['cannon','triple','multiple','drill','laser','digger','floater','stinger'];
for(let i=0;i<weapons.length;i++)await asset('weapon-'+weapons[i],'weapon',[await moduleFrame(i+4,[54,56,42,32],true)],
 {weaponPivot:[64,72],muzzle:[96,72]},{idle:one(),fire:clip([0],[180],false),wreck:one()});
await asset('glasses-blue','accessory',[await moduleFrame(12,[39,32,14,7])],{attach:[46,39]},{idle:one()});
await asset('scarf-orange','accessory',[await moduleFrame(13,[33,49,25,12])],{attach:[47,53]},{idle:one()});
const effectBox=i=>{
 const row=[[40,330],[390,310],[720,240],[1030,170]][Math.floor(i/4)], edges=[0,310,600,930,1254],column=i%4;
 return [...row,edges[column]-Math.floor(column*1254/4),Math.floor((column+1)*1254/4)-edges[column+1]];
};
for(const [id,indices,rect,durations,loop] of [
 ['explosion',[0,1,2,3],[36,36,56,56],[70,120,300,100],false],
 ['smoke',[4,5,6,7],[50,40,28,28],[150,200,250,300],true],
 ['muzzle',[8,9,10],[62,55,25,18],[30,30,30],false],
 ['spark',[11],[54,54,20,20],[120],false]]) {
 await asset('effect-'+id,'effect',await frameGroup('effects',indices,rect,effectBox,true),{origin:[64,64]},
  {play:clip(indices.map((_,i)=>i),durations,loop)});
}
for(let i=0;i<weapons.length;i++){
 const source=[12,12,12,13,14,12,12,15][i], w=[9,7,5,11,16,12,9,13][i];
 await asset('projectile-'+weapons[i],'projectile',[await frame('effects',source,[64,62,w,4],effectBox(source))],{origin:[64,64]},{fly:one()});
}
writeFileSync(join(root,'pack.json'),JSON.stringify({version:1,id:'baseline-v1',productionMethod:'imagegen',metricsStatus:'draft',artPixelsPerCell:8,assets},null,2)+'\n');
console.log(`Exported ${assets.length} assets; draft metrics, human review pending.`);
