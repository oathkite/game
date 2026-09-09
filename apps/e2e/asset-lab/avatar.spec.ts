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
