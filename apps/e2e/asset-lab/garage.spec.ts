import { createHash } from 'node:crypto';
import { COLOR_HEX } from '../../../packages/protocol/src/constants.js';
import { test, expect, type Page } from '@playwright/test';
async function seek(page: Page, time: number) {
  await page.locator('#scrub').evaluate((input, value) => {
    (input as HTMLInputElement).value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, time);
}
const pixels = async (page: Page) => createHash('sha256').update(await page.locator('#stage').evaluate(node => (node as HTMLCanvasElement).toDataURL())).digest('hex');
test.beforeEach(async ({ page }) => {
  await page.goto('/'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  await seek(page, 0);
});
test('play, pause, step and reset control the clock', async ({ page }) => {
  await page.locator('#step').click(); await expect(page.locator('#time')).not.toHaveText('0 ms');
  await page.locator('#restart').click(); await expect(page.locator('#time')).toHaveText('0 ms');
  await page.locator('#play').click(); await expect(page.locator('#live-state')).toContainText('再生中');
  await expect(page.locator('#time')).not.toHaveText('0 ms');
  await page.locator('#play').click(); const text = await page.locator('#time').textContent();
  await page.waitForTimeout(100); await expect(page.locator('#time')).toHaveText(text!);
});
test('all nine animations change rendered pixels across time', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const state of ['idle', 'move', 'fire', 'hit', 'low-hp', 'fall', 'land', 'destroy', 'wreck']) {
    await page.locator(`[data-state="${state}"]`).click(); await seek(page, 0);
    const first = await pixels(page); await seek(page, state === 'low-hp' ? 700 : state === 'move' ? 110 : 200);
    expect(await pixels(page), state).not.toEqual(first);
  }
  expect(errors).toEqual([]);
});
test('destroy holds wreck and low HP survives temporary reactions', async ({ page }) => {
  await page.locator('[data-state="destroy"]').click(); await seek(page, 1000);
  await expect(page.locator('#live-state')).toContainText('残骸');
  await page.locator('#hp').fill('20'); await page.locator('[data-state="hit"]').click(); await seek(page, 500);
  await expect(page.locator('#live-state')).toContainText('低 HP');
});
test('eight weapons, palette, accessories and direction affect actual composition', async ({ page }) => {
  const variants = new Set<string>();
  for (const id of ['cannon', 'triple', 'multiple', 'drill', 'laser', 'digger', 'floater', 'stinger']) {
    await page.locator('#weapon').selectOption(id); variants.add(await pixels(page));
  }
  expect(variants.size).toBe(8);
  const originalColor = await pixels(page); await page.locator('#primary').fill('#ed8b8b');
  expect(await pixels(page)).not.toEqual(originalColor);
  const plain = await pixels(page); await page.locator('#glasses').check(); await page.locator('#scarf').check();
  expect(await pixels(page)).not.toEqual(plain);
  const right = await pixels(page); await page.locator('#facing').selectOption('-1');
  expect(await pixels(page)).not.toEqual(right);
  await page.locator('#angle').fill('90'); await page.locator('#anchors').check();
  await expect(page.locator('#angle-value')).toHaveText('90°');
});
test('inspection exports its scope and never records human approval', async ({ page }) => {
  await page.locator('#run-checks').click(); await expect(page.locator('#check-summary')).toContainText('41 / 41');
  await expect(page.locator('#check-results .fail')).toHaveCount(0);
  const event = page.waitForEvent('download'); await page.locator('#export').click();
  const download = await event; const stream = await download.createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  const report = JSON.parse(Buffer.concat(chunks).toString());
  expect(report.renderSamples).toBeGreaterThanOrEqual(352); expect(report.humanReview).toBe('pending');
  expect(report.checks.every((c: { pass: boolean }) => c.pass)).toBe(true);
});
test('mobile layout stays inside viewport with usable controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('[data-state="destroy"]').click(); await seek(page, 400);
  await page.locator('#weapon').selectOption('laser');
  await page.locator('#run-checks').click(); await expect(page.locator('#check-summary')).toContainText('41 / 41');
});
test('frame buttons seek exact artwork boundaries and fall reaches landing', async ({ page }) => {
  await page.locator('[data-state="destroy"]').click();
  await page.locator('#frame-strip button').nth(1).click();
  await expect(page.locator('#time')).toHaveText('120 ms');
  await expect(page.locator('#live-state')).toContainText('停止中');
  await page.locator('[data-state="fall"]').click(); await seek(page, 800);
  await expect(page.locator('#live-state')).toContainText('着地');
  await seek(page, 1250); await expect(page.locator('#live-state')).toContainText('待機');
});
test('changing motion keeps preview looping, while one-shot can hold its end', async ({ page }) => {
  await page.locator('[data-state="destroy"]').click(); await seek(page, 990);
  await page.locator('#play').click(); await page.waitForTimeout(250);
  await expect(page.locator('#live-state')).toContainText('再生中');
  await expect(page.locator('#time')).not.toHaveText('1000 ms');
  await page.locator('#repeat').uncheck(); await seek(page, 990);
  await page.locator('#play').click(); await page.waitForTimeout(250);
  await expect(page.locator('#live-state')).toContainText('停止中 / 残骸');
});
test('preview preserves aspect ratio and device resolution when resized while paused', async ({ browser }) => {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ deviceScaleFactor: dpr });
    const page = await context.newPage(); await page.goto('/');
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true'); await seek(page, 0);
    for (const width of [390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => page.locator('#stage').evaluate(node => {
        const canvas = node as HTMLCanvasElement, rect = canvas.getBoundingClientRect();
        return Math.abs(canvas.width - rect.width * devicePixelRatio) <= .5 &&
          Math.abs(canvas.height - rect.height * devicePixelRatio) <= .5 &&
          Math.abs(rect.width / rect.height - 25 / 13) < .01;
      })).toBe(true);
    }
    await context.close();
  }
});

test('49 paint combinations preserve the pilot and independent accessories', async ({ page }) => {
  const colors = Object.values(COLOR_HEX);
  const result = await page.evaluate(async values => {
    const modulePath = '/renderer.mjs';
    const { loadPack, render } = await import(modulePath);
    const library = await loadPack(), canvas = document.createElement('canvas');
    canvas.width = 510; canvas.height = 310;
    const config = { state: 'idle', weapon: 'cannon', glasses: true, scarf: true, hp: 100, angle: 10, facing: 1, zoom: 1, slope: 0 };
    const hash = async () => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
      canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data))).join(',');
    const pilots = new Set<string>(), machines = new Set<string>();
    for (const primary of values) for (const secondary of values) {
      render(library, canvas, { ...config, primary, secondary, pilotOnly: true }, 0); pilots.add(await hash());
      render(library, canvas, { ...config, primary, secondary }, 0); machines.add(await hash());
    }
    return { pilots: pilots.size, machines: machines.size };
  }, colors);
  expect(result).toEqual({ pilots: 1, machines: 49 });
});

test('every gallery fits the seated tank at desktop and mobile widths', async ({ page }) => {
  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const fits = await page.locator('.motion-card canvas').evaluateAll(async nodes => {
      const modulePath = '/geometry.mjs';
      const { previewGeometry } = await import(modulePath);
      return nodes.every(node => {
        const rect = node.getBoundingClientRect(), g = previewGeometry(rect.width, rect.height, devicePixelRatio);
        // Union of normal tank bounds, plus 12 art px of falling clearance.
        return g.x - 72 * g.scale >= 0 && g.x + 52 * g.scale <= g.width && g.y - 102 * g.scale >= 0;
      });
    });
    expect(fits, String(width)).toBe(true);
  }
});

test('energy weapons emit cyan light without a gunpowder flash', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/renderer.mjs';
    const { loadPack, render } = await import(modulePath);
    const library = await loadPack(), canvas = document.createElement('canvas');
    canvas.width = 510; canvas.height = 310;
    const result: Record<string, { warm: number; cyan: number }> = {};
    for (const weapon of ['cannon', 'laser', 'floater']) {
      render(library, canvas, { state: 'fire', weapon, primary: '#ffc345', secondary: '#ed8244',
        glasses: false, scarf: false, hp: 100, angle: 0, facing: 1, zoom: 1, slope: 0 }, 30);
      const pixels = canvas.getContext('2d')!.getImageData(322, 130, 40, 40).data;
      let warm = 0, cyan = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i]! > 180 && pixels[i + 1]! < 170 && pixels[i + 2]! < 100) warm++;
        if (pixels[i]! < 170 && pixels[i + 1]! > 180 && pixels[i + 2]! > 180) cyan++;
      }
      result[weapon] = { warm, cyan };
    }
    return result;
  });
  expect(result.cannon!.warm).toBeGreaterThan(0);
  for (const weapon of ['laser', 'floater']) {
    expect(result[weapon]!.warm, weapon).toBe(0);
    expect(result[weapon]!.cyan, weapon).toBeGreaterThan(0);
  }
});

test('chassis beige and yellow highlights follow paint without staining glass', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/renderer.mjs';
    const { loadPack, render } = await import(modulePath);
    const library = await loadPack(), canvas = document.createElement('canvas');
    canvas.width = 510; canvas.height = 310;
    const config = { state: 'idle', weapon: 'cannon', glasses: false, scarf: false, hp: 100, angle: 0, facing: 1, zoom: 1, slope: 0 };
    const results: Record<string, { warm: number; mean: number[]; glass: number[] }> = {};
    for (const primary of ['#000000', '#ff00aa', '#0088ff']) {
      render(library, canvas, { ...config, primary, secondary: '#000000' }, 0);
      // Central lower chassis panel: excludes pilot, wheels and weapon.
      const pixels = canvas.getContext('2d')!.getImageData(132, 164, 56, 30).data;
      let warm = 0; const mean = [0, 0, 0];
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i]! - pixels[i + 2]! > 25 && pixels[i + 1]! - pixels[i + 2]! > 10) warm++;
        for (let j = 0; j < 3; j++) mean[j]! += pixels[i + j]!;
      }
      // Reflection inside the dome, away from pilot and rim.
      const glass = Array.from(canvas.getContext('2d')!.getImageData(190, 84, 6, 6).data);
      results[primary] = { warm, mean, glass };
    }
    return results;
  });
  for (const value of Object.values(result)) expect(value.warm).toBe(0);
  expect(result['#ff00aa']!.mean[0]).toBeGreaterThan(result['#ff00aa']!.mean[1]!);
  expect(result['#0088ff']!.mean[2]).toBeGreaterThan(result['#0088ff']!.mean[0]!);
  expect(result['#ff00aa']!.glass).toEqual(result['#000000']!.glass);
  expect(result['#0088ff']!.glass).toEqual(result['#000000']!.glass);
});

test('digger impact uses the same explosion pixels as cannon', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/renderer.mjs';
    const { loadPack, render } = await import(modulePath);
    const library = await loadPack(), canvas = document.createElement('canvas');
    canvas.width = 510; canvas.height = 310;
    const pixels = (weapon: string) => {
      render(library, canvas, { state: 'fire', weapon, primary: '#ffc345', secondary: '#ed8244',
        glasses: false, scarf: false, hp: 100, angle: 0, facing: 1, zoom: 1, slope: 0 }, 450);
      return [...canvas.getContext('2d')!.getImageData(350, 50, 160, 250).data];
    };
    return { cannon: pixels('cannon'), digger: pixels('digger') };
  });
  expect(result.digger).toEqual(result.cannon);
  expect(result.cannon.some((v, i, p) => i % 4 === 0 && v > 180 && p[i + 1]! < 170 && p[i + 2]! < 100)).toBe(true);
});

test('wreck becomes grayscale after destruction while the scene keeps its colors', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/renderer.mjs';
    const { loadPack, render } = await import(modulePath);
    const library = await loadPack(), canvas = document.createElement('canvas');
    canvas.width = 510; canvas.height = 310;
    const sample = (state: string, time: number) => {
      render(library, canvas, { state, weapon: 'cannon', primary: '#ffc345', secondary: '#ed8244',
        glasses: true, scarf: true, hp: 100, angle: 0, facing: 1, zoom: 1, slope: 0 }, time);
      const ctx = canvas.getContext('2d')!;
      const pixels = [...ctx.getImageData(140, 176, 35, 16).data];
      let colored = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (Math.max(...pixels.slice(i, i + 3)) - Math.min(...pixels.slice(i, i + 3)) > 2) colored++;
      }
      return { colored, corner: [...ctx.getImageData(0, 0, 1, 1).data] };
    };
    return { idle: sample('idle', 0), wreck: sample('wreck', 200), transition: sample('destroy', 600) };
  });
  expect(result.idle.colored).toBeGreaterThan(100);
  for (const state of [result.wreck, result.transition]) {
    expect(state.colored).toBe(0);
    expect(state.corner).toEqual(result.idle.corner);
  }
});

test('wreck barrel droops independently of the last aiming angle', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const modulePath = '/renderer.mjs';
    const { loadPack, render } = await import(modulePath);
    const library = await loadPack(), canvas = document.createElement('canvas');
    canvas.width = 510; canvas.height = 310;
    const sample = (angle: number) => {
      const rotations: number[] = [], ctx = canvas.getContext('2d')!;
      const rotate = ctx.rotate.bind(ctx);
      ctx.rotate = (radians: number) => { rotations.push(radians); rotate(radians); };
      render(library, canvas, { state: 'wreck', weapon: 'cannon', primary: '#ffc345', secondary: '#ed8244',
        glasses: true, scarf: true, hp: 0, angle, facing: 1, zoom: 1, slope: 0 }, 200);
      ctx.rotate = rotate;
      return { pixels: [...ctx.getImageData(0, 0, 510, 310).data], rotations };
    };
    return { low: sample(10), high: sample(80) };
  });
  expect(result.low.pixels).toEqual(result.high.pixels);
  expect(result.low.rotations.at(-1)).toBeCloseTo(18 * Math.PI / 180);
});
