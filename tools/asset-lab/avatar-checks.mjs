export function portraitChecks(manifest,images){
 const checks=[],add=(name,pass,details=[])=>checks.push({name,pass,details});
 const [w,h]=manifest.frameSize;
 const alpha=(id,frame,x,y)=>images.get(id).rgba[(y*images.get(id).width+frame*w+x)*4+3];
 add('本人専用の利用区分',manifest.availability.scope==='owner-only'&&manifest.availability.grantKey==='kita-personal');
 add('基本・喜び・悲しみの3ポーズ',['neutral','happy','sad'].every(id=>manifest.poses.some(p=>p.id===id)));
 add('全ポーズの素体縮尺が共通',new Set(manifest.metrics.body.map(m=>m.scale)).size===1);
 add('静止ポーズとアニメーションを区別',manifest.animationStatus==='representative-still-poses-only');
 for(const pose of manifest.poses){
  let bottom=-1,edge=false,contact={glasses:0,scarf:0},hidden=0;
  const eyes=pose.eyeAreas??[pose.faceArea];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const body=alpha('body',pose.frame,x,y)>200;
   if(body)bottom=Math.max(bottom,y);
   for(const id of ['body','glasses','scarf'])if(alpha(id,pose.frame,x,y)>200&&(x===0||y===0||x===w-1||y===h-1))edge=true;
   for(const id of ['glasses','scarf']){
    const gear=alpha(id,pose.frame,x,y)>200;
    if(gear&&body)contact[id]++;
    if(gear&&eyes.some(([fx,fy,fw,fh])=>x>=fx&&x<fx+fw&&y>=fy&&y<fy+fh))hidden++;
   }
  }
  add(pose.id+'：足元が共通基準',Math.abs(bottom-(manifest.foot[1]-1))<=2,[bottom]);
  add(pose.id+'：キャンバス端で切れない',!edge);
  add(pose.id+'：メガネとスカーフが素体に接触',contact.glasses>0&&contact.scarf>0,[contact]);
  add(pose.id+'：自然の目を装備が隠さない',hidden===0,[hidden]);
 }
 return checks;
}
