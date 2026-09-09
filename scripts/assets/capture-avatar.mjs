import {createRequire} from 'node:module';
import {mkdirSync,copyFileSync} from 'node:fs';
const {chromium}=createRequire(new URL('../../apps/e2e/package.json',import.meta.url))('@playwright/test');
const out='assets/previews/avatar-kita-v1';mkdirSync(out,{recursive:true});
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 await page.goto('http://127.0.0.1:4178/avatar.html');await page.waitForSelector('body[data-ready=true]');
 if(await page.locator('#play').getAttribute('aria-pressed')==='true')await page.locator('#play').click();
 for(const pose of ['neutral','happy','sad']){
  await page.locator(`[data-pose=${pose}]`).click();await page.locator('#portrait').screenshot({path:out+'/'+pose+'.png'});
 }
 const download=page.waitForEvent('download');await page.locator('#download').click();await(await download).saveAs(out+'/inspection.json');
 await page.setViewportSize({width:1280,height:530});
 await page.evaluate(async()=>{
  const {loadPortrait}=await import('/avatar-renderer.mjs'),library=await loadPortrait();
  const {loadPack}=await import('/renderer.mjs'),tank=await loadPack();
  const {drawAvatarScene}=await import('/avatar-scene.mjs');
  document.body.replaceChildren();document.body.style.cssText='margin:0;padding:16px;background:#f4efdf;display:grid;grid-template-columns:repeat(3,1fr);gap:16px';
  for(const pose of library.manifest.poses){
   const card=document.createElement('section'),canvas=document.createElement('canvas'),label=document.createElement('p');
   canvas.style.cssText='width:100%;height:448px;display:block';label.textContent=pose.label;label.style.cssText='text-align:center;font:14px sans-serif';
   card.append(canvas,label);document.body.append(card);drawAvatarScene(library,tank,canvas,pose.id,{backdrop:'dark'});
  }
 });
 await page.screenshot({path:out+'/poses.png',fullPage:true});
 await page.setViewportSize({width:1664,height:1472});
 await page.evaluate(async()=>{
  const {loadPortrait,drawPortrait}=await import('/avatar-renderer.mjs'),library=await loadPortrait();
  document.body.replaceChildren();document.body.style.gridTemplateColumns='repeat(4,1fr)';
  for(const pose of library.manifest.poses)for(const frame of pose.clip.frames){
   const card=document.createElement('section'),canvas=document.createElement('canvas'),label=document.createElement('p');
   canvas.style.cssText='width:100%;height:448px;display:block';label.textContent=pose.label+' / '+(frame%4+1);label.style.cssText='text-align:center;font:14px sans-serif';
   card.append(canvas,label);document.body.append(card);drawPortrait(library,canvas,pose.id,{frame,backdrop:'dark'});
  }
 });
 await page.screenshot({path:out+'/frames.png',fullPage:true});
 await page.setViewportSize({width:1800,height:420});
 await page.evaluate(async()=>{
  const {loadPortrait}=await import('/avatar-renderer.mjs'),avatar=await loadPortrait();
  const {loadPack}=await import('/renderer.mjs'),tank=await loadPack();
  const {drawAvatarScene}=await import('/avatar-scene.mjs');
  document.body.replaceChildren();document.body.style.cssText='margin:0;padding:0;background:#203746;display:flex';
  for(const pose of avatar.manifest.poses){
   const canvas=document.createElement('canvas');canvas.style.cssText='width:600px;height:420px;display:block';document.body.append(canvas);
   drawAvatarScene(avatar,tank,canvas,pose.id,{backdrop:'dark'});
  }
 });
 await page.screenshot({path:out+'/tank-comparison.png'});
 copyFileSync(out+'/tank-comparison.png','assets/workbench/avatar-kita-v1/tank-comparison.png');
 await page.setViewportSize({width:1440,height:1100});
 await page.goto('http://127.0.0.1:4178/avatar.html');await page.waitForSelector('body[data-ready=true]');
 if(await page.locator('#play').getAttribute('aria-pressed')==='true')await page.locator('#play').click();
 await page.screenshot({path:out+'/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/mobile.png',fullPage:true});
 console.log('Portrait desktop, mobile, frames and live tank comparison captured.');
}finally{await browser.close();}
