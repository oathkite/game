export function portraitFrame(clip,elapsedMs){
 const total=clip.durations.reduce((a,b)=>a+b,0);
 let time=((elapsedMs%total)+total)%total;
 for(let i=0;i<clip.frames.length;i++){
  if(time<clip.durations[i])return clip.frames[i];
  time-=clip.durations[i];
 }
 return clip.frames[0];
}
