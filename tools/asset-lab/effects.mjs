// Coordinates are art pixels; keep event scheduling independent of preview FPS.
export function effectInstances(pose,cabin) {
 const instances=[],add=(id,time,point,alpha=1)=>instances.push({id:'effect-'+id,time,point,alpha});
 if(pose.smoke){
  const count=pose.state==='wreck'?4:3,[x,y]=cabin.anchors.damageSmoke;
  for(let i=0;i<count;i++){
   const age=(pose.time+i*900/count)%900,phase=age/900;
   add('smoke',age,[x+i*7,y+pose.bodyY-Math.round(phase*16)],.75*Math.sin(Math.PI*phase));
  }
 }
 if(pose.explosion>=0){
  for(const [delay,x,y]of [[0,85,105],[80,70,110],[140,112,108]]){
   const age=pose.clipTime-delay;
   if(age>=0)add('explosion',age*590/(600-delay),[x,y],Math.min(1,(600-pose.clipTime)/130));
  }
 }
 if(pose.state==='hit'&&pose.clipTime<300)add('spark',pose.clipTime,[115,107]);
 if(pose.state==='land')for(const x of [58,86,116]){
  add('dust',pose.clipTime,[x,cabin.anchors.ground[1]],.8*Math.min(1,(450-pose.clipTime)/100));
 }
 return instances;
}
