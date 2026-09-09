import { clipFrame, poseAt, firingMotion } from './animation.mjs';
import { previewGeometry } from './geometry.mjs';
import { effectInstances } from './effects.mjs';
import { recolor } from './paint.mjs';
const base='/assets/workbench/baseline-v2/';
export async function loadPack() {
  const response=await fetch(base+'pack.json');
  if(!response.ok)throw new Error('pack.json を読み込めません');
  const pack=await response.json(), images=new Map();
  await Promise.all(pack.assets.map(async asset=>{
    const res=await fetch(base+asset.file);if(!res.ok)throw new Error(asset.file+' を読み込めません');
    const bytes=new Uint8Array(await res.arrayBuffer()), bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
    const palette=[];const view=new DataView(bytes.buffer);
    for(let offset=8;offset<bytes.length;){
      const size=view.getUint32(offset), type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
      if(type==='PLTE')for(let p=offset+8;p<offset+8+size;p+=3)palette.push([bytes[p],bytes[p+1],bytes[p+2]]);
      offset+=size+12;
    }
    const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
    images.set(asset.id,{asset,bitmap,palette,width:bitmap.width,height:bitmap.height,rgba:ctx.getImageData(0,0,bitmap.width,bitmap.height).data});
  }));
  return {pack,images,cache:new Map()};
}
function tinted(library,id,colors) {
  const key=id+colors.primary+colors.secondary;
  if(library.cache.has(key))return library.cache.get(key);
  const {asset,bitmap,palette}=library.images.get(id), canvas=document.createElement('canvas');
  canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height), changes=new Map();
  palette.forEach((rgb,i)=>{
    const role=asset.paletteRoles[i], owner=role.startsWith('primary-')?'primary':role.startsWith('secondary-')?'secondary':null;
    if(!owner)return;
    const tone=asset.paletteTones?.[i]??(role.endsWith('light')?.15:role.endsWith('dark')?-.35:0);
    changes.set(rgb.join(','),recolor(colors[owner],tone));
  });
  for(let i=0;i<pixels.data.length;i+=4){const color=changes.get([pixels.data[i],pixels.data[i+1],pixels.data[i+2]].join(','));
    if(color&&pixels.data[i+3]===255)pixels.data.set(color,i);
  }
  ctx.putImageData(pixels,0,0);library.cache.set(key,canvas);return canvas;
}
function draw(library,ctx,id,clip,time,colors,x=0,y=0) {
  const entry=library.images.get(id);if(!entry)throw new Error('Missing asset '+id);
  const frame=clipFrame(entry.asset.clips[clip],time), source=tinted(library,id,colors),[w,h]=entry.asset.frameSize;
  const columns=source.width/w;
  ctx.drawImage(source,frame%columns*w,Math.floor(frame/columns)*h,w,h,x,y,w,h);
  return frame;
}
function background(ctx,w,h) {
  ctx.fillStyle='#1b3044';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#294354';ctx.lineWidth=1;
  for(let x=0;x<w;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h*.8);ctx.stroke();}
  for(let y=0;y<h*.8;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  ctx.fillStyle='#304d57';ctx.fillRect(0,h*.8,w,h*.2);
  ctx.fillStyle='#6b8f87';ctx.fillRect(0,h*.8,w,3);
  ctx.fillStyle='#446069';for(let x=25;x<w;x+=80)ctx.fillRect(x,h*.86,35,3);
}
function effectAt(library,ctx,id,time,cfg,point) {
  const origin=library.images.get(id).asset.anchors.origin;
  draw(library,ctx,id,'play',time,cfg,point[0]-origin[0],point[1]-origin[1]);
}
function effects(library,ctx,pose,cfg) {
  const cabin=library.images.get('cabin-standard').asset;
  for(const effect of effectInstances(pose,cabin)){
    ctx.save();ctx.globalAlpha=effect.alpha;
    effectAt(library,ctx,effect.id,effect.time,cfg,effect.point);ctx.restore();
  }
}
function shot(library,ctx,cfg,t,lane,recoil) {
  if(t<0||t>=870)return;
  const weapon=library.images.get('weapon-'+cfg.weapon).asset;
  const muzzle=weapon.emissionPorts[weapon.emissionPorts.length===1?0:lane+1];
  if(t<140){
    const energy=['laser','floater'].includes(cfg.weapon);ctx.save();
    if(energy)ctx.globalAlpha=1-t/140;
    effectAt(library,ctx,energy?'effect-energy':'effect-muzzle',energy?0:t,cfg,[muzzle[0]-recoil,muzzle[1]]);ctx.restore();
  }
  const flight=Math.min(t,280),point=[muzzle[0]+flight*.22,muzzle[1]+lane*flight*.035+flight*flight*.00005];
  if(t<280){
    const id='projectile-'+cfg.weapon,origin=library.images.get(id).asset.anchors.origin;
    draw(library,ctx,id,'fly',t,cfg,Math.round(point[0]-origin[0]),Math.round(point[1]-origin[1]));
  }else{
    const kind={laser:'energy',floater:'energy',drill:'drill'}[cfg.weapon]??'explosion';
    ctx.save();ctx.translate(...point);ctx.scale(.6,.6);
    effectAt(library,ctx,'effect-'+kind,t-280,cfg,[0,0]);ctx.restore();
  }
}
function gun(library,ctx,pose,cfg) {
  const pivot=library.images.get('cabin-standard').asset.anchors.weaponPivot;
  const {times,recoil}=firingMotion(cfg.weapon,pose);
  ctx.save();ctx.translate(pivot[0],pivot[1]+pose.bodyY);ctx.rotate(-(pose.state==='wreck'?-18:cfg.angle)*Math.PI/180);ctx.translate(-pivot[0],-pivot[1]);
  draw(library,ctx,'weapon-'+cfg.weapon,pose.state==='wreck'?'wreck':'idle',pose.clipTime,cfg,-recoil,0);
  if(pose.state==='fire')times.forEach((t,i)=>shot(library,ctx,cfg,t,times.length>1?i%3-1:0,recoil));
  ctx.restore();
}
function pilot(library,ctx,pose,cfg) {
  const asset=library.images.get('pilot-frog').asset;
  const frame=draw(library,ctx,'pilot-frog',pose.state,pose.clipTime,cfg,0,pose.bodyY);
  const anchors={...asset.anchors,...asset.frameAnchors?.[frame]};
  for(const [enabled,id,anchor]of[[cfg.glasses,'glasses-blue','headAnchor'],[cfg.scarf,'scarf-orange','neckAnchor']]){
    if(!enabled)continue;
    const original=library.images.get(id).asset.anchors.attach, destination=anchors[anchor];
    draw(library,ctx,id,'idle',pose.time,cfg,destination[0]-original[0],destination[1]-original[1]+pose.bodyY);
  }
}
export function render(library,canvas,cfg,time,requested=cfg.state) {
  const bounds=canvas.getBoundingClientRect();
  const geometry=previewGeometry(bounds.width || canvas.width,bounds.height || canvas.height,bounds.width?window.devicePixelRatio:1,cfg.zoom);
  if(canvas.width!==geometry.width)canvas.width=geometry.width;
  if(canvas.height!==geometry.height)canvas.height=geometry.height;
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pose=poseAt(requested,time,cfg.hp);
  ctx.imageSmoothingEnabled=false;background(ctx,w,h);ctx.save();
  const scale=geometry.scale, cabin=library.images.get('cabin-standard').asset,ground=cabin.anchors.ground;
  ctx.translate(geometry.x,geometry.y);ctx.scale(scale*cfg.facing,scale);ctx.rotate(-cfg.slope*Math.PI/180);ctx.translate(-ground[0],-ground[1]+pose.airborne);
  drawMachine(library,ctx,cfg,time,pose);
  ctx.restore();return pose;
}

// Draw in native art pixels; callers control scene placement and shared scale.
export function drawMachine(library,ctx,cfg,time,pose=poseAt(cfg.state,time,cfg.hp)) {
  const cabin=library.images.get('cabin-standard').asset,ground=cabin.anchors.ground;
  if(pose.state==='wreck')ctx.filter='grayscale(1)';
  else if(pose.flash)ctx.filter='brightness(0) invert(1)';
  if(!cfg.pilotOnly){
    draw(library,ctx,'tracks-standard',pose.state==='move'?'move':pose.state==='wreck'?'wreck':'idle',time,cfg);
  }
  ctx.save();ctx.translate(cfg.pilotOnly?0:firingMotion(cfg.weapon,pose).bodyX,0);
  if(!cfg.pilotOnly)draw(library,ctx,'cabin-standard','idle-back',time,cfg,0,pose.bodyY);
  if(!cfg.hidePilot)pilot(library,ctx,pose,cfg);
  if(!cfg.pilotOnly){
    draw(library,ctx,'cabin-standard','idle',time,cfg,0,pose.bodyY);
    draw(library,ctx,'cabin-standard','idle-glass',time,cfg,0,pose.bodyY);
    draw(library,ctx,'cabin-standard','idle-front',time,cfg,0,pose.bodyY);
    gun(library,ctx,pose,cfg);effects(library,ctx,pose,cfg);
  }
  ctx.restore();
  if(cfg.anchors){
    ctx.strokeStyle='#f1c46a';ctx.lineWidth=.5;ctx.strokeRect(...library.images.get('cabin-standard').asset.faceSafeArea);
    for(const [x,y]of[ground,cabin.anchors.pilotSeat,cabin.anchors.weaponPivot]){ctx.fillStyle='#f18b7b';ctx.fillRect(x-1,y-1,2,2);}
  }
}

export function faceClearance(library, cfg) {
  const canvas=document.createElement('canvas'),cabin=library.images.get('cabin-standard').asset;
  [canvas.width,canvas.height]=cabin.frameSize;const [px,py]=cabin.anchors.weaponPivot;
  const ctx=canvas.getContext('2d'),area=library.images.get('cabin-standard').asset.faceSafeArea;
  const areas=[area,...Object.values(library.images.get('pilot-frog').asset.frameFaceAreas)];
  const failures=[];
  for(const entry of library.pack.assets.filter(a=>a.kind==='weapon'))for(let angle=10;angle<=90;angle++)for(const recoil of [0,1,2,3]){
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.translate(px,py);ctx.rotate(-angle*Math.PI/180);ctx.translate(-px,-py);
    draw(library,ctx,entry.id,'idle',0,cfg,-recoil,0);ctx.restore();
    if(areas.some(a=>ctx.getImageData(...a).data.some((v,i)=>i%4===3&&v>128)))failures.push({weapon:entry.id,angle,recoil});
  }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  draw(library,ctx,'cabin-standard','idle-front',0,cfg);
  const canopyClear=areas.every(a=>!ctx.getImageData(...a).data.some((v,i)=>i%4===3&&v>128));
  return {pass:failures.length===0,failures,canopyClear};
}
