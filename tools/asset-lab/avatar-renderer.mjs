const base='/assets/workbench/avatar-kita-v1/';
export async function loadPortrait(){
 const response=await fetch(base+'avatar.json');if(!response.ok)throw new Error('アバター定義を読み込めません');
 const manifest=await response.json(),images=new Map();
 for(const layer of manifest.layers){
  const response=await fetch(base+layer.file);if(!response.ok)throw new Error(layer.file+'を読み込めません');
  const bitmap=await createImageBitmap(await response.blob()),canvas=document.createElement('canvas');
  canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
  images.set(layer.id,{bitmap,width:bitmap.width,height:bitmap.height,rgba:ctx.getImageData(0,0,bitmap.width,bitmap.height).data});
 }
 return {manifest,images};
}
export function drawPortrait(library,canvas,poseId,{guides=false,backdrop=null,frame=null}={}){
 const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
 canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
 const ctx=canvas.getContext('2d'),[w,h]=library.manifest.frameSize,pose=library.manifest.poses.find(p=>p.id===poseId);
 const scale=Math.max(1,Math.floor(Math.min(canvas.width/w,canvas.height/h))),x=Math.round((canvas.width-w*scale)/2),y=Math.round((canvas.height-h*scale)/2);
 ctx.imageSmoothingEnabled=false;
 if(backdrop){ctx.fillStyle=backdrop==='dark'?'#203746':'#f4efdf';ctx.fillRect(0,0,canvas.width,canvas.height);}
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 for(const layer of library.manifest.layers){
  ctx.drawImage(library.images.get(layer.id).bitmap,(frame??pose.frame)*w,0,w,h,0,0,w,h);
 }
 if(guides){ctx.strokeStyle='#e47854';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,library.manifest.foot[1]);ctx.lineTo(w,library.manifest.foot[1]);ctx.stroke();
 }
 ctx.restore();return {scale,pose:pose.id};
}
