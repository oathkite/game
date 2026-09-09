import {test,expect} from '@playwright/test';
test.beforeEach(async ({page})=>{
 await page.clock.install();
 await page.goto('/avatar.html');await page.waitForSelector('body[data-ready=true]');
});
test('all three sprite animations advance through four drawings and loop after switching',async ({page})=>{
 const manifest=await page.evaluate(async()=>await(await fetch('/assets/workbench/avatar-kita-v1/avatar.json')).json());
 const canvas=page.locator('#portrait');
 for(const pose of manifest.poses){
  await page.locator(`[data-pose=${pose.id}]`).click();
  const samples=new Set<string>();
  for(let i=0;i<4;i++){
   await expect(canvas).toHaveAttribute('data-frame',String(pose.clip.frames[i]));
   samples.add(await canvas.evaluate((c:HTMLCanvasElement)=>c.toDataURL()));
   await page.clock.runFor(pose.clip.durations[i]);
  }
  await expect(canvas).toHaveAttribute('data-frame',String(pose.clip.frames[0]));
  expect(samples.size).toBe(4);
 }
 await expect(page.locator('#glasses, #scarf')).toHaveCount(0);
});
test('pause holds the drawing and step advances one actual sprite frame',async ({page})=>{
 await page.locator('#play').click();
 const frame=await page.locator('#portrait').getAttribute('data-frame');
 await page.clock.runFor(5000);await expect(page.locator('#portrait')).toHaveAttribute('data-frame',frame!);
 await page.locator('#step').click();await expect(page.locator('#portrait')).toHaveAttribute('data-frame','1');
 await page.locator('#play').click();await page.clock.runFor(250);
 await expect(page.locator('#portrait')).not.toHaveAttribute('data-frame','1');
});
test('report validates all 12 frames while keeping human approval pending',async ({page})=>{
 const event=page.waitForEvent('download');await page.locator('#download').click();
 const download=await event,stream=await download.createReadStream();let text='';for await(const chunk of stream!)text+=chunk.toString();
 const report=JSON.parse(text);expect(report.frames).toBe(12);expect(report.checks.every((c:{pass:boolean})=>c.pass)).toBe(true);
 expect(report.humanReview).toBe('pending');expect(report.scope).toContain('animated loop');
});
test('workshop supports mobile resize and reduced-motion playback starts paused',async ({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForSelector('body[data-ready=true]');
 await expect(page.locator('#play')).toHaveAttribute('aria-pressed','false');
 await page.setViewportSize({width:390,height:844});await page.clock.runFor(32);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect.poll(()=>page.locator('#portrait').evaluate((c:HTMLCanvasElement)=>c.width===Math.round(c.getBoundingClientRect().width*devicePixelRatio))).toBe(true);
 await page.locator('[data-pose=happy]').click();await expect(page.locator('#pose-title')).toHaveText('喜ぶ');
});
test('portraits share tank pixel scale, draw the frog in front, and leave the cockpit empty',async ({page})=>{
 const result=await page.evaluate(async()=>{
  const avatarPath='/avatar-renderer.mjs',tankPath='/renderer.mjs',scenePath='/avatar-scene.mjs';
  const {loadPortrait}=await import(avatarPath);
  const {loadPack}=await import(tankPath);
  const {drawAvatarScene}=await import(scenePath);
  const avatar=await loadPortrait(),tank=await loadPack();
  const canvas=document.querySelector<HTMLCanvasElement>('#portrait')!;
  tank.images.delete('pilot-frog'); // A seated pilot draw must fail in this scene.
  const ctx=canvas.getContext('2d')!,original=ctx.drawImage;
  const calls:{scale:number;avatar:boolean}[]=[];
  ctx.drawImage=function(source:CanvasImageSource,...args:number[]){
   calls.push({scale:this.getTransform().a,avatar:source===avatar.images.get('character').bitmap});
   Reflect.apply(original,this,[source,...args]);
  };
  return avatar.manifest.poses.map((pose:{id:string})=>{
   calls.length=0;const scene=drawAvatarScene(avatar,tank,canvas,pose.id);
   return {...scene,firstScale:calls[0]!.scale,lastScale:calls.at(-1)!.scale,
    lastIsAvatar:calls.at(-1)!.avatar,drawCount:calls.length};
  });
 });
 for(const scene of result){
  expect(scene.avatarScale).toBe(scene.tankScale);
  expect(scene.firstScale).toBe(scene.lastScale);
  expect(scene.lastIsAvatar).toBe(true);
  expect(scene.drawCount).toBeGreaterThan(1);
  expect(Number.isInteger(scene.avatarScale)).toBe(true);
  expect(scene.pilotVisible).toBe(false);
  expect(scene.drawOrder).toEqual(['tank','avatar']);
  expect(scene.avatarGroundY).toBeGreaterThan(scene.tankGroundY);
 }
});
test('body and scarf colors update every preview independently and reset exactly',async ({page})=>{
 await page.locator('#play').click();
 const snapshots=()=>page.evaluate(()=>['portrait','profile-art','win-art','lose-art'].map(id=>(document.getElementById(id) as HTMLCanvasElement).toDataURL()));
 const original=await snapshots(),frame=await page.locator('#portrait').getAttribute('data-frame');
 await page.locator('#skin-color').fill('#65b878');const green=await snapshots();
 green.forEach((value,i)=>expect(value).not.toBe(original[i]));
 await page.locator('#scarf-color').fill('#4867d5');const blue=await snapshots();
 blue.forEach((value,i)=>expect(value).not.toBe(green[i]));
 await expect(page.locator('#portrait')).toHaveAttribute('data-frame',frame!);
 await page.locator('#reset-colors').click();expect(await snapshots()).toEqual(original);
 await page.locator('#skin-color').fill('#65b878');await page.locator('#scarf-color').fill('#4867d5');
 await page.locator('[data-pose=happy]').click();await page.locator('#play').click();await page.clock.runFor(220);
 await expect(page.locator('#portrait')).toHaveAttribute('data-frame','5');
 await expect(page.locator('#skin-color')).toHaveValue('#65b878');
 await expect(page.locator('#scarf-color')).toHaveValue('#4867d5');
 await page.locator('#portrait').screenshot({path:'../../assets/previews/avatar-kita-v1/custom-colors.png'});
});
