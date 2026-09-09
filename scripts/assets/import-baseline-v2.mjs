import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rimMask } from './production.mjs';
import { root, source, frame, landmark, asset, clip, one } from './production-export.mjs';
const assets=[], add=async(...args)=>assets.push(await asset(...args));
const ids=['cannon','triple','multiple','drill','laser','digger','floater','stinger'];
const eyes=[[151,75],[151,75],[151,78],[169,90],[155,78],[157,79],[103,72],[151,73],
 [153,82],[173,101],[154,89],[113,65],[184,100],[173,113],[176,100],[178,119]];
const pilotFrames=[],frameAnchors={},frameFaceAreas={};
for(let i=0;i<16;i++){
 const src=await source('pilot',i,4,4),ox=i%4*256,oy=Math.floor(i/4)*256;
 const f=await frame(src,.19,null,{point:[ox+108,oy+(i<12?219:199)],target:[55,97],group:'pilot'});pilotFrames.push(f);
 const eye=landmark(f,[ox+eyes[i][0],oy+eyes[i][1]]);
 frameAnchors[i]={headAnchor:[eye[0]-1,eye[1]-4],neckAnchor:[eye[0]-1,eye[1]+11]};
 frameFaceAreas[i]=[eye[0]-2,eye[1]-2,4,5];
}
await add('pilot-frog','pilot',pilotFrames,{pilotSeat:[55,97],...frameAnchors[0]}, {
 idle:clip([0,1,2,0],[500,500,100,100]),move:clip([3,4],[100,100]),fire:clip([0],[180],false),
 hit:clip([7,8,0],[100,100,200],false),'low-hp':clip([9,10,9],[600,300,700]),fall:one(11),land:clip([12,0],[150,30],false),
 destroy:clip([7,13,14],[120,330,150],false),wreck:one(15),
},{frameAnchors,frameFaceAreas});
const body=await Promise.all([0,1,2,3].map(i=>source('body-v2',i,2,2)));
const bodyFrames=[await frame(await source('interior',0,1,1),.055,[40,70]),await frame(body[1],.215,[24,80]),
 await frame(await source('glass',0,1,1),.09,[29,57]),await frame(body[3],.19,[24,57])];
bodyFrames[2]={...bodyFrames[2],raw:rimMask(bodyFrames[2].raw,bodyFrames[3].raw,192,160),metrics:{...bodyFrames[2].metrics,alphaMaskFrame:3}};
await add('cabin-standard','cabin',bodyFrames,{ground:[96,144],pilotSeat:[55,97],weaponPivot:[96,96],damageSmoke:[30,95]},
 {idle:one(1),wreck:one(1),'idle-back':one(0),'idle-glass':one(2),'idle-front':one(3)},
 {alphaMode:'glass',glassFrame:2,faceSafeArea:[59,63,5,8],layers:['idle-back','pilot','idle','idle-glass','idle-front']});
const tracks=[];
for(let i=0;i<4;i++){
 const src=await source('tracks',i,2,2),scale=108/476,outputSize=src.sourceSize.map(v=>Math.round(v*scale));
 tracks.push(await frame(src,scale,[24,144-outputSize[1]],{group:'tracks'}));
}
await add('tracks-standard','undercarriage',tracks,{ground:[96,144],cabinMount:[76,112],exhaust:[28,114]},
 {idle:one(),move:clip([0,1,2],[90,90,90]),wreck:one(3)});
// Explicit cell bounds exclude the neighbouring drill/stinger housing, which precedes the nominal column.
const edges=[0,390,780,1120,1536],muzzleY=[322,324,312,324,186,187,184,188];
for(let i=0;i<8;i++){
 const row=Math.floor(i/4),col=i%4,src=await source('weapons',i,4,2,[edges[col],row*512,edges[col+1]-edges[col],512]);
 const scale=60/src.sourceSize[0],tip=[src.sourceOrigin[0]+src.sourceSize[0]-1,row*512+muzzleY[i]];
 const f=await frame(src,scale,null,{point:tip,target:[144,96]});
 await add('weapon-'+ids[i],'weapon',[f],{weaponPivot:[96,96],muzzle:[144,96]}, {idle:one(),fire:clip([0],[180],false),wreck:one()},
  {emissionPorts:(i===1?[-7,0,7]:i===2?[-10,0,9]:[0]).map(dy=>[144,96+dy])});
}
for(const [id,index,scale,point,target]of[
 ['glasses-blue',0,.035,[354,347],[62,57]],['scarf-orange',2,.045,[335,754],[63,74]],
]){
 const src=await source('accessories',index,2,2),f=await frame(src,scale,null,{point,target});
 await add(id,'accessory',[f],{attach:target},{idle:one()});
}
const ammoEdges=[0,256,512,750,1024];
for(let i=0;i<8;i++){
 const col=i%4,row=Math.floor(i/4),replacement=i===4||i===5;
 const src=replacement?await source('ammo-revised',i===5?0:1,1,2,i===5?[0,0,1024,650]:[0,650,1024,374]):
  await source('projectiles',i,4,2,[ammoEdges[col],row*512,ammoEdges[col+1]-ammoEdges[col],512]);
 const scale=[24,9,6,24,36,26,18,32][i]/src.sourceSize[0];
 const point=i===5?[505,406]:src.sourceOrigin.map((v,j)=>v+src.sourceSize[j]/2);
 const f=await frame(src,scale,null,{point,target:[96,96]});
 await add('projectile-'+ids[i],'projectile',[f],{origin:[96,96]},{fly:one()});
}
const fxRows=[[0,320],[320,230],[550,200],[750,274]];
for(const [sheet,row,id,scale,origin,point,durations,loop]of[
 ['effects-v2',0,'explosion',.5,[96,96],[128,205],[70,120,220,180],false],
 ['effects-v2',1,'smoke',.3,[96,96],[128,500],[150,200,250,300],true],
 ['effects-v2',2,'muzzle',.17,[96,96],[90,657],[25,35,40,40],false],
 ['effects-v2',3,'spark',.17,[96,96],[128,870],[40,60,80,120],false],
 ['effects-extra',0,'dust',.35,[96,96],[128,245],[60,100,130,160],false],
 ['effects-extra',1,'energy',.25,[96,96],[128,430],[50,90,150,220],false],
 ['effects-extra',2,'drill',.22,[96,96],[128,687],[50,90,150,220],false],
 ['effects-extra',3,'dig',.25,[96,96],[128,981],[50,90,150,220],false],
]){
 const frames=[];
 for(let col=0;col<4;col++){
  const region=sheet==='effects-v2'?[col*256,fxRows[row][0],256,fxRows[row][1]]:
   row===2?[col*256,550,256,218]:undefined;
  const src=await source(sheet,row*4+col,4,4,region);
  const emissionX=id==='muzzle'?(col<3?src.sourceOrigin[0]:col*256+32):point[0]+col*256;
  frames.push(await frame(src,scale,null,{point:[emissionX,point[1]],target:origin,group:id}));
 }
 await add('effect-'+id,'effect',frames,{origin},{play:clip([0,1,2,3],durations,loop)});
}
const pack={version:1,id:'baseline-v2',productionMethod:'imagegen',metricsStatus:'draft',artPixelsPerCell:12,
 generationModel:'gpt-image-2.5-sunburst',qaProfile:'modular-pilot-v2',assets};
writeFileSync(join(root,'pack.json'),JSON.stringify(pack,null,2)+'\n');
console.log(`Exported ${assets.length} new assets, ${assets.reduce((n,a)=>n+a.exportMetrics.length,0)} frames.`);
