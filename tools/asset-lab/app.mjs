import { STATES, WEAPONS, runChecks } from './animation.mjs';
import { loadPack, render, faceClearance } from './renderer.mjs';
import { exportChecks } from './quality.mjs';
import { pixelChecks } from './pixel-quality.mjs';
const $=id=>document.getElementById(id);
const config={state:'idle',weapon:'cannon',primary:'#ffc345',secondary:'#ed8244',glasses:false,scarf:false,hp:100,angle:10,facing:1,zoom:1,slope:0,anchors:false,pilotOnly:false};
let playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,time=0,speed=1,last=0,library,report;
const cards=[];
function choose(state){
  config.state=state;time=0;
  $('state-name').textContent=STATES[state].label;$('state-note').textContent=STATES[state].note;
  $('scrub').max=String(STATES[state].duration);
  for(const b of $('states').children)b.setAttribute('aria-pressed',String(b.dataset.state===state));
  let elapsed=0;
  $('frame-strip').replaceChildren(...library.images.get('pilot-frog').asset.clips[state].frames.map((frame,i)=>{
    const at=elapsed;elapsed+=library.images.get('pilot-frog').asset.clips[state].durationsMs[i];
    const b=document.createElement('button');b.textContent=`コマ ${frame} · ${at} ms`;
    b.onclick=()=>{time=at;playing=false;paint();};return b;
  }));
  paint();
}
function controls(){
  for(const [state,info]of Object.entries(STATES)){
    const b=document.createElement('button');b.textContent=info.label;b.dataset.state=state;b.onclick=()=>choose(state);$('states').append(b);
    const card=document.createElement('button');card.className='motion-card';card.setAttribute('aria-label',info.label+'を試験台で見る');
    const canvas=document.createElement('canvas');canvas.width=300;canvas.height=200;
    const caption=document.createElement('span');caption.textContent=info.label;
    const note=document.createElement('small');note.textContent=info.duration+' ms';caption.append(note);
    card.append(canvas,caption);card.onclick=()=>choose(state);$('gallery').append(card);cards.push({state,canvas});
  }
  for(const [id,name]of Object.entries(WEAPONS)){const option=document.createElement('option');option.value=id;option.textContent=name;$('weapon').append(option);}
  for(const id of ['weapon','primary','secondary','glasses','scarf','hp','angle','facing','zoom','slope','anchors','pilot-only']){
    $(id).addEventListener('input',e=>{
      const input=e.target,key=id==='pilot-only'?'pilotOnly':id;
      config[key]=input.type==='checkbox'?input.checked:['hp','angle','facing','zoom','slope'].includes(id)?Number(input.value):input.value;
      if(id==='primary'||id==='secondary')library?.cache.clear();
      for(const name of ['hp','angle','slope'])$(name+'-value').value=config[name]+(name==='hp'?'':'°');
      paint();
    });
  }
}
function paint(){
  if(!library)return;
  const pose=render(library,$('stage'),config,time);
  $('live-state').textContent=(playing?'再生中':'停止中')+' / '+STATES[pose.state].label;
  $('play').textContent=playing?'一時停止':'再生';$('play').setAttribute('aria-label',playing?'一時停止':'再生');
  $('time').value=Math.round(time)+' ms';$('scrub').value=String(time);
  for(const card of cards)render(library,card.canvas,{...config,zoom:1,anchors:false},time%STATES[card.state].duration,card.state);
}
function tick(now){
  if(playing&&library){time+=Math.min(100,now-last)*speed;
    if(!['fire','hit','land','destroy','fall'].includes(config.state))time%=STATES[config.state].duration;
    else if(time>=STATES[config.state].duration){
      if($('repeat').checked)time%=STATES[config.state].duration;
      else{time=STATES[config.state].duration;playing=false;}
    }
    paint();
  }
  last=now;requestAnimationFrame(tick);
}
function inspect(){
  const checks=[...runChecks(library.pack),...exportChecks(library.pack),...pixelChecks(library.pack,library.images)];
  const clearance=faceClearance(library,config);
  checks.push({name:'8 武器・全仰角で顔の保護領域を確保',pass:clearance.pass});
  checks.push({name:'キャノピーの反射が顔を隠さない',pass:clearance.canopyClear});
  // Render every state at several boundaries, including both facings and angle extremes.
  const sample=document.createElement('canvas');sample.width=300;sample.height=200;
  let count=0;
  for(const state of Object.keys(STATES)){
    let pass=true;
    const clip=library.images.get('pilot-frog').asset.clips[state];
    const boundaries=clip.durationsMs.reduce((times,d)=>[...times,times.at(-1)+d],[0]);
    const times=[...new Set([0,70,190,590,1000,STATES[state].duration,...boundaries.flatMap(t=>[Math.max(0,t-1),t])])];
    try{for(const facing of [-1,1])for(const angle of [10,90])for(const t of times){
      render(library,sample,{...config,facing,angle,zoom:1,hp:state==='low-hp'?20:100},t,state);count++;
      const data=sample.getContext('2d').getImageData(0,0,300,200).data;
      pass&&=data.some((v,i)=>i%4===0&&v>150);
    }}catch{pass=false;}
    checks.push({name:STATES[state].label+'：左右・角度の描画',pass});
  }
  report={pack:library.pack.id,at:new Date().toISOString(),configuration:{...config},checks,renderSamples:count,faceClearance:clearance,humanReview:'pending',scope:'asset-lab animation only; not game physics'};
  $('check-results').replaceChildren(...checks.map(c=>{const li=document.createElement('li');li.textContent=c.name;li.className=c.pass?'pass':'fail';return li;}));
  const passed=checks.filter(c=>c.pass).length;
  $('check-summary').textContent=`${passed} / ${checks.length} 項目に合格。${count} 通りの描画を確認。`;
  $('export').disabled=false;
}
controls();
new ResizeObserver(()=>paint()).observe($('stage').parentElement);
$('play').onclick=()=>{if(!playing&&time>=STATES[config.state].duration)time=0;playing=!playing;paint();};$('restart').onclick=()=>{time=0;paint();};
$('step').onclick=()=>{playing=false;time=Math.min(time+1000/60,STATES[config.state].duration);paint();};
$('scrub').oninput=e=>{playing=false;time=Number(e.target.value);paint();};$('speed').onchange=e=>{speed=Number(e.target.value);};
$('run-checks').disabled=true;$('run-checks').onclick=inspect;
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='fortress-animation-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
try{
  library=await loadPack();$('run-checks').disabled=false;
  $('pack-status').textContent=`${library.pack.assets.length} 素材 / 試作・目視承認待ち`;
  document.body.dataset.ready='true';choose('idle');requestAnimationFrame(tick);
}catch(error){$('error').hidden=false;$('error').textContent='素材を読み込めませんでした。'+error.message;}
