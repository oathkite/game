import {defaultSkinColor,defaultScarfColor} from './avatar-paint.mjs';
import {loadPortrait} from './avatar-renderer.mjs';
import {portraitChecks} from './avatar-checks.mjs';
import {loadPack} from './renderer.mjs';
import {drawAvatarScene} from './avatar-scene.mjs';
import {portraitFrame} from './avatar-timing.mjs';
const $=id=>document.getElementById(id);
try{
 const [library,tank]=await Promise.all([loadPortrait(),loadPack()]);let pose='neutral',report=null,elapsed=0,last=null,signature='';
 let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const colors=()=>({skinColor:$('skin-color').value,scarfColor:$('scarf-color').value});
 const selected=()=>library.manifest.poses.find(p=>p.id===pose);
 const render=(force=false)=>{
  const state=library.manifest.poses.map(p=>portraitFrame(p.clip,elapsed)),key=pose+state.join(',');
  if(!force&&key===signature)return;signature=key;
  const options={guides:$('guides').checked,...colors()},frame=portraitFrame(selected().clip,elapsed);
  drawAvatarScene(library,tank,$('portrait'),pose,{...options,frame,backdrop:$('backdrop').value});
  $('portrait').dataset.frame=String(frame);
  for(const [id,index]of [['profile-art',0],['win-art',1],['lose-art',2]])drawAvatarScene(library,tank,$(id),library.manifest.poses[index].id,{...options,frame:state[index]});
  $('pose-title').textContent=selected().label;
  $('play').textContent=playing?'一時停止':'再生';
  $('play').setAttribute('aria-pressed',String(playing));
  $('frame-label').textContent=(selected().clip.frames.indexOf(frame)+1)+' / '+selected().clip.frames.length+' コマ';
 };
 for(const button of document.querySelectorAll('[data-pose]'))button.addEventListener('click',()=>{
  pose=button.dataset.pose;elapsed=0;
  for(const b of document.querySelectorAll('[data-pose]'))b.setAttribute('aria-pressed',String(b===button));
  render(true);
 });
 for(const id of ['guides','backdrop'])$(id).addEventListener('change',()=>render(true));
 for(const id of ['skin-color','scarf-color'])$(id).addEventListener('input',()=>render(true));
 $('reset-colors').addEventListener('click',()=>{$('skin-color').value=defaultSkinColor;$('scarf-color').value=defaultScarfColor;render(true);});
 $('play').addEventListener('click',()=>{playing=!playing;render(true);});
 $('step').addEventListener('click',()=>{
  playing=false;const clip=selected().clip,index=(clip.frames.indexOf(portraitFrame(clip,elapsed))+1)%clip.frames.length;
  elapsed=clip.durations.slice(0,index).reduce((a,b)=>a+b,0);render(true);
 });
 new ResizeObserver(()=>render(true)).observe($('portrait'));
 const inspect=()=>{
  const checks=portraitChecks(library.manifest,library.images),samples=new Set();
  for(const p of library.manifest.poses)for(const frame of p.clip.frames){
   drawAvatarScene(library,tank,$('portrait'),p.id,{frame,backdrop:'dark',...colors()});samples.add($('portrait').toDataURL());
  }
  checks.push({name:'全12コマの絵が異なる',pass:samples.size===library.manifest.frameCount});render(true);
  report={pack:library.manifest.id,checks,frames:samples.size,scope:'3 animated loop clips; integrated sprites',colors:colors(),humanReview:'pending'};
  $('report').textContent=checks.filter(c=>c.pass).length+' / '+checks.length+' 項目通過\n3アニメーション・12コマ\n人のレビュー待ち'+checks.filter(c=>!c.pass).map(c=>'\n要確認：'+c.name).join('');
  $('download').disabled=false;
 };
 $('inspect').addEventListener('click',inspect);
 $('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='avatar-inspection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const tick=now=>{if(last!==null&&playing&&!document.hidden)elapsed+=now-last;last=now;render();requestAnimationFrame(tick);};
 render(true);inspect();document.body.dataset.ready='true';requestAnimationFrame(tick);
}catch(error){$('error').hidden=false;$('error').textContent=error.message;}
