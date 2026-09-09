import {portraitBitmap} from './avatar-renderer.mjs';
import {drawMachine} from './renderer.mjs';
// Both assets use native art pixels. Depth changes position, never sprite scale.
const scene={width:280,height:190,tank:[114,154],avatar:[167,172]};
export function drawAvatarScene(avatar,tank,canvas,poseId,{frame=null,backdrop=null,guides=false,skinColor,scarfColor}={}){
 const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
 canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
 const ctx=canvas.getContext('2d'),scale=Math.max(1,Math.floor(Math.min(canvas.width/scene.width,canvas.height/scene.height)));
 const x=Math.round((canvas.width-scene.width*scale)/2),y=Math.round((canvas.height-scene.height*scale)/2);
 ctx.imageSmoothingEnabled=false;
 if(backdrop){ctx.fillStyle=backdrop==='dark'?'#203746':'#f4efdf';ctx.fillRect(0,0,canvas.width,canvas.height);}
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 const cfg={state:'idle',weapon:'cannon',primary:'#ffc345',secondary:'#ed8244',hidePilot:true,glasses:false,scarf:false,hp:100,angle:10};
 const ground=tank.images.get('cabin-standard').asset.anchors.ground;
 ctx.save();ctx.translate(scene.tank[0]-ground[0],scene.tank[1]-ground[1]);drawMachine(tank,ctx,cfg,0);ctx.restore();
 const [w,h]=avatar.manifest.frameSize,[fx,fy]=avatar.manifest.foot,pose=avatar.manifest.poses.find(p=>p.id===poseId);
 ctx.drawImage(portraitBitmap(avatar,skinColor,scarfColor),(frame??pose.frame)*w,0,w,h,scene.avatar[0]-fx,scene.avatar[1]-fy,w,h);
 if(guides){
  ctx.fillStyle='#e47854';ctx.fillRect(0,scene.tank[1],scene.width,1);
  ctx.fillStyle='#e4be61';ctx.fillRect(scene.avatar[0]-fx,scene.avatar[1],w,1);
 }
 ctx.restore();
 return {tankScale:scale,avatarScale:scale,pilotVisible:false,drawOrder:['tank','avatar'],tankGroundY:scene.tank[1],avatarGroundY:scene.avatar[1]};
}
