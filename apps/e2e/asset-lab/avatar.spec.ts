import {test,expect} from '@playwright/test';
test.beforeEach(async ({page})=>{
 await page.goto('/avatar.html');await page.waitForSelector('body[data-ready=true]');
});
test('portrait poses and accessories render 12 distinct combinations',async ({page})=>{
 await page.locator('#inspect').click();await expect(page.locator('#report')).toContainText('17 / 17');
 const samples=new Set<string>();
 for(const pose of ['neutral','happy','sad'])for(const glasses of [false,true])for(const scarf of [false,true]){
  await page.locator(`[data-pose=${pose}]`).click();await page.locator('#glasses').setChecked(glasses);await page.locator('#scarf').setChecked(scarf);
  samples.add(await page.locator('#portrait').evaluate((c:HTMLCanvasElement)=>c.toDataURL()));
 }
 expect(samples.size).toBe(12);
 await page.locator('#backdrop').selectOption('light');await page.locator('#guides').check();
 await expect(page.locator('[data-pose=sad]')).toHaveAttribute('aria-pressed','true');
});
test('portrait report records draft stills and never fabricates human approval',async ({page})=>{
 const event=page.waitForEvent('download');await page.locator('#download').click();
 const download=await event,stream=await download.createReadStream();let text='';for await(const chunk of stream!)text+=chunk.toString();
 const report=JSON.parse(text);expect(report.combinations).toBe(12);expect(report.humanReview).toBe('pending');expect(report.scope).toContain('static poses');
});
test('portrait workshop fits mobile and preserves pixel scale on resize',async ({page})=>{
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect.poll(()=>page.locator('#portrait').evaluate((c:HTMLCanvasElement)=>c.width===Math.round(c.getBoundingClientRect().width*devicePixelRatio))).toBe(true);
 await page.locator('[data-pose=happy]').click();await expect(page.locator('#pose-title')).toHaveText('喜ぶ');
});
