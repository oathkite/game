import {loadPortrait,drawPortrait} from './avatar-renderer.mjs';
import {portraitChecks} from './avatar-checks.mjs';
const $=id=>document.getElementById(id);
try{
 const library=await loadPortrait();let pose='neutral',report=null;
 const render=()=>{
  const options={glasses:$('glasses').checked,scarf:$('scarf').checked,guides:$('guides').checked};
  drawPortrait(library,$('portrait'),pose,{...options,backdrop:$('backdrop').value});
  for(const [id,state]of [['profile-art','neutral'],['win-art','happy'],['lose-art','sad']])drawPortrait(library,$(id),state,options);
  $('pose-title').textContent=library.manifest.poses.find(p=>p.id===pose).label;
 };
 for(const button of document.querySelectorAll('[data-pose]'))button.addEventListener('click',()=>{
  pose=button.dataset.pose;for(const b of document.querySelectorAll('[data-pose]'))b.setAttribute('aria-pressed',String(b===button));render();
 });
 for(const id of ['glasses','scarf','guides','backdrop'])$(id).addEventListener('change',render);
 new ResizeObserver(render).observe($('portrait'));
 const inspect=()=>{
  const checks=portraitChecks(library.manifest,library.images),samples=new Set();
  for(const p of library.manifest.poses)for(const glasses of [false,true])for(const scarf of [false,true]){
   drawPortrait(library,$('portrait'),p.id,{glasses,scarf,backdrop:'dark'});samples.add($('portrait').toDataURL());
  }
  checks.push({name:'3ポーズ×装備4通りを描画',pass:samples.size===12});render();
  report={pack:library.manifest.id,checks,combinations:samples.size,scope:'3 static poses × 4 accessory combinations; no animation playback certification',humanReview:'pending'};
  $('report').textContent=`${checks.filter(c=>c.pass).length} / ${checks.length} 項目通過\n3ポーズ・装備4通り\n静止原画 / 人のレビュー待ち`+checks.filter(c=>!c.pass).map(c=>'\n要確認：'+c.name).join('');
  $('download').disabled=false;
 };
 $('inspect').addEventListener('click',inspect);
 $('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='avatar-inspection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 render();inspect();document.body.dataset.ready='true';
}catch(error){$('error').hidden=false;$('error').textContent=error.message;}
