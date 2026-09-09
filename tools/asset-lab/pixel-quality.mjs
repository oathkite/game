// Pixel-level composition checks shared by Node export validation and the browser.
export function framePixels(image,asset,index) {
 const [width,height]=asset.frameSize,columns=image.width/width,out=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++){
  const start=((Math.floor(index/columns)*height+y)*image.width+index%columns*width)*4;
  out.set(image.rgba.subarray(start,start+width*4),y*width*4);
 }
 return {width,height,rgba:out};
}
const alpha=(p,x,y)=>x<0||y<0||x>=p.width||y>=p.height?0:p.rgba[(Math.round(y)*p.width+Math.round(x))*4+3];
function area(p,rect,threshold=200){
 let n=0;for(let y=rect[1];y<rect[1]+rect[3];y++)for(let x=rect[0];x<rect[0]+rect[2];x++)if(alpha(p,x,y)>threshold)n++;return n;
}
function bounds(p){
 const points=[];for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++)if(alpha(p,x,y)>200)points.push([x,y]);
 return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
function effectPalette(pack,images) {
 return pack.assets.filter(a=>a.kind==='effect'&&a.id!=='effect-energy').every(a=>{
  const p=images.get(a.id);
  for(let i=0;i<p.rgba.length;i+=4)if(p.rgba[i+3]>200&&p.rgba[i]<150&&p.rgba[i+1]>130&&p.rgba[i+2]>160)return false;
  return true;
 });
}
function glassContained(glass,rim){
 for(let y=0;y<glass.height;y++){
  let left=glass.width,right=-1;
  for(let x=0;x<glass.width;x++)if(alpha(rim,x,y)>200){left=Math.min(left,x);right=x;}
  for(let x=0;x<glass.width;x++)if(alpha(glass,x,y)>0&&(x<left||x>right))return false;
 }
 return true;
}
export function pixelChecks(pack,images) {
 const get=id=>pack.assets.find(a=>a.id===id),at=(id,index=0)=>framePixels(images.get(id),get(id),index);
 const pilot=get('pilot-frog'),glasses=get('glasses-blue'),cabin=get('cabin-standard');
 const front=at(cabin.id,cabin.clips.idle.frames[0]),glass=at(cabin.id,cabin.clips['idle-glass'].frames[0]),gear=at(glasses.id);
 const failures={contact:[],eyes:[],glass:[],seated:[],muzzle:[]};
 for(const key of Object.keys(pilot.frameAnchors)){
  const i=Number(key),p=at(pilot.id,i),eye=pilot.frameFaceAreas[i],head=pilot.frameAnchors[i].headAnchor;
  const dx=head[0]-glasses.anchors.attach[0],dy=head[1]-glasses.anchors.attach[1];let contacts=0,hidden=0;
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
   if(alpha(gear,x-dx,y-dy)>200&&alpha(p,x,y)>200)contacts++;
   if(alpha(gear,x-dx,y-dy)>200&&x>=eye[0]&&x<eye[0]+eye[2]&&y>=eye[1]&&y<eye[1]+eye[3])hidden++;
  }
  if(contacts<1)failures.contact.push(i);if(hidden>0)failures.eyes.push(i);
  if(area(glass,eye,0)<eye[2]*eye[3]*.8||area(glass,eye,160)>0)failures.glass.push(i);
  const [sx,sy]=pilot.anchors.pilotSeat;
  if(area(front,[sx-3,sy-2,8,5])<20)failures.seated.push(i);
 }
 const track=at('tracks-standard'),tb=bounds(track),fb=bounds(front),ground=cabin.anchors.ground[1];
 const support=tb[3]===ground-1&&tb[2]-tb[0]>=.9*(fb[2]-fb[0])&&tb[2]-tb[0]<=1.3*(fb[2]-fb[0])&&tb[3]-tb[1]>=30;
 for(const weapon of pack.assets.filter(a=>a.kind==='weapon')){
  const p=at(weapon.id),ports=[weapon.anchors.muzzle,...(weapon.emissionPorts??[])];
  if(ports.some(([x,y])=>area(p,[x-3,y-3,7,7])===0))failures.muzzle.push(weapon.id);
 }
 const dispersal=pack.assets.filter(a=>a.kind==='effect').every(a=>{
  const counts=a.clips.play.frames.map(i=>area(at(a.id,i),[0,0,...a.frameSize]));
  return counts[0]<Math.max(...counts)&&counts.at(-1)<Math.max(...counts)*.8;
 });
 return [
  {name:'画素：全ポーズでメガネが頭に接触',pass:!failures.contact.length,details:failures.contact},
  {name:'画素：メガネが自然の目を遮らない',pass:!failures.eyes.length,details:failures.eyes},
  {name:'画素：ガラス越しに全ポーズの目が見える',pass:!failures.glass.length,details:failures.glass},
  {name:'画素：腰を車体前面で隠して搭乗を表現',pass:!failures.seated.length,details:failures.seated},
  {name:'画素：履帯の厚み・車体幅・接地を整合',pass:support},
  {name:'画素：8武器の砲口と発射位置を整合',pass:!failures.muzzle.length,details:failures.muzzle},
  {name:'画素：演出が拡張して最後に消散する',pass:dispersal},
  {name:'画素：暖色の演出に隣のエネルギー片が混入しない',pass:effectPalette(pack,images)},
  {name:'画素：ガラスが枠の外へはみ出さない',pass:glassContained(glass,at(cabin.id,cabin.clips['idle-front'].frames[0]))},
  {name:'画素：発射光の根元を砲口に固定',pass:[0,1,2].every(i=>Math.abs(bounds(at('effect-muzzle',i))[0]-get('effect-muzzle').anchors.origin[0])<=1)},
 ];
}
