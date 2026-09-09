// Repeatable visual evidence captured from the real asset-lab renderer, not a separate mock-up.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const {chromium}=createRequire(new URL('../../apps/e2e/package.json',import.meta.url))('@playwright/test');
const output=resolve('assets/previews/asset-lab-v2');mkdirSync(output,{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.goto('http://127.0.0.1:4178/');await page.waitForSelector('body[data-ready=true]');
 await page.getByRole('button',{name:'一時停止',exact:true}).click();await page.locator('#restart').click();
 await page.locator('#glasses').check();await page.locator('#scarf').check();await page.locator('#run-checks').click();
 const download=page.waitForEvent('download');await page.locator('#export').click();await(await download).saveAs(output+'/automatic-report.json');
 await page.screenshot({path:output+'/desktop.png',fullPage:true});
 await page.locator('#stage').screenshot({path:output+'/machine.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/mobile.png',fullPage:true});
 await page.setViewportSize({width:1600,height:1100});
 for(const mode of ['poses','weapons','effects','fire','damage','paint']){
  await page.evaluate(async mode=>{
   const {loadPack,render}=await import('/renderer.mjs'),lib=await loadPack();
   const cfg={state:'idle',weapon:'cannon',primary:'#ffc345',secondary:'#ed8244',glasses:true,scarf:true,hp:100,angle:10,facing:1,zoom:2,slope:0};
   document.body.replaceChildren();document.body.style.cssText='padding:20px;background:#f6f1df;display:grid;grid-template-columns:repeat(4,1fr);gap:12px';
   const create=label=>{const card=document.createElement('div'),title=document.createElement('p'),canvas=document.createElement('canvas');
    title.textContent=label;title.style.cssText='margin:8px;font:14px monospace';canvas.style.cssText='width:100%;aspect-ratio:5/4;image-rendering:pixelated';
    canvas.width=360;canvas.height=288;card.append(canvas,title);document.body.append(card);return canvas;};
   if(mode==='poses')for(let i=0;i<16;i++){
    lib.images.get('pilot-frog').asset.clips.idle.frames=[i];lib.images.get('pilot-frog').asset.clips.idle.durationsMs=[1000];
    render(lib,create('POSE '+i),cfg,0);
   }
   if(mode==='weapons')for(const a of lib.pack.assets.filter(a=>a.kind==='weapon')){
    render(lib,create(a.id),{...cfg,weapon:a.id.slice(7)},0);
   }
   if(mode==='fire')for(const weapon of ['cannon','triple','multiple','drill','laser','digger','floater','stinger'])for(const time of [0,30,70,120]){
    render(lib,create(weapon+' / '+time+'ms'),{...cfg,state:'fire',weapon},time);
   }
   if(mode==='paint')for(const primary of ['#467aff','#000000','#ff0088']){
    render(lib,create(primary),{...cfg,primary,secondary:'#eeee44'},0);
   }
   if(mode==='damage')for(const state of ['destroy','land','low-hp','wreck'])for(const time of [0,150,350,550]){
    render(lib,create(state+' / '+time+'ms'),{...cfg,state,hp:state==='low-hp'?20:state==='wreck'?0:100},time);
   }
   if(mode==='effects')for(const a of lib.pack.assets.filter(a=>a.kind==='effect'))for(const i of a.clips.play.frames){
    const canvas=create(a.id+' / '+i);canvas.width=384;canvas.height=320;canvas.style.aspectRatio='6/5';const ctx=canvas.getContext('2d'),entry=lib.images.get(a.id),[w,h]=a.frameSize,columns=entry.bitmap.width/w;
    ctx.fillStyle='#1b3044';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(entry.bitmap,i%columns*w,Math.floor(i/columns)*h,w,h,0,0,canvas.width,canvas.height);
   }
  },mode);
  await page.screenshot({path:output+'/'+mode+'.png',fullPage:true});
 }
 console.log('Saved desktop, mobile, 16 poses, 8 weapons, 32 VFX frames and inspection report.');
}finally{await browser.close();}
