export function portraitChecks(manifest,images){
 const checks=[],add=(name,pass,details=[])=>checks.push({name,pass,details});
 const [w,h]=manifest.frameSize,image=images.get('character');
 add('本人専用の利用区分',manifest.availability.scope==='owner-only'&&manifest.availability.grantKey==='kita-personal');
 add('待機・喜び・悲しみの3状態',['neutral','happy','sad'].every(id=>manifest.poses.some(p=>p.id===id)));
 add('装いを含む一体スプライト',manifest.composition==='integrated'&&manifest.layers.length===1&&manifest.layers[0].id==='character');
 const scales=new Map();
 for(const metric of manifest.metrics.character){const key=metric.sourceSheet??'default';if(!scales.has(key))scales.set(key,new Set());scales.get(key).add(metric.scale);}
 add('各動作の全コマが共通縮尺',[...scales.values()].every(values=>values.size===1));
 add('アニメーション形式',manifest.animationStatus==='animated-loop-clips');
 for(const pose of manifest.poses){
  const clip=pose.clip;
  add(pose.id+'：コマ・時間・ループ定義',clip.loop===true&&clip.frames.length>=4&&clip.frames.length===clip.durations.length&&clip.durations.every(d=>Number.isFinite(d)&&d>0)&&clip.frames.every(f=>Number.isInteger(f)&&f>=0&&f<manifest.frameCount));
 }
 for(let frame=0;frame<manifest.frameCount;frame++){
  let bottom=-1,edge=false;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   if(image.rgba[(y*image.width+frame*w+x)*4+3]<=200)continue;
   bottom=Math.max(bottom,y);
   if(x===0||y===0||x===w-1||y===h-1)edge=true;
  }
  add('frame '+frame+'：接地・空中位置が登録通り',Math.abs(bottom-(manifest.foot[1]-1-(manifest.metrics.character[frame].footLift??0)))<=2,[bottom]);
  add('frame '+frame+'：キャンバス端で切れない',!edge);
 }
 return checks;
}
