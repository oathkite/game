import { test, expect, type Page } from "@playwright/test";

const open = async (page: Page) => {
  await page.goto('/?prototype=camera');
  await expect(page.getByTestId('camera-world')).toHaveAttribute('data-loaded', 'true');
  await expect(page.getByTestId('prototype-fire')).toBeEnabled();
  await page.mouse.move(500, 10);
};
const state = (page: Page) => page.evaluate(() => {
  const v = window.__fortress!.getView();
  return { x: v.control?.x, elevation: v.control?.elevation, turn: v.turnNumber, phase: v.phase };
});

test('drag pans without moving or aiming; C returns to the actor', async ({ page }) => {
  await open(page);
  const before = await state(page), world = page.getByTestId('camera-world');
  const cameraX = Number(await world.getAttribute('data-camera-x'));
  const endX = cameraX > 200 ? 1000 : 300;
  await page.mouse.move(650, 400); await page.mouse.down(); await page.mouse.move(endX, 400, { steps: 12 }); await page.mouse.up();
  await expect(world).toHaveAttribute('data-mode', 'manual');
  expect(Math.abs(Number(await world.getAttribute('data-camera-x')) - cameraX)).toBeGreaterThan(20);
  expect(await state(page)).toEqual(before);
  await page.keyboard.press('c');
  await expect(world).toHaveAttribute('data-mode', 'actor');
  await expect.poll(async () => Math.abs(Number(await world.getAttribute('data-camera-x')) - cameraX)).toBeLessThan(1);
});

test('edge scroll stops on HUD and settings cancel charge', async ({ page }) => {
  await open(page);
  const world = page.getByTestId('camera-world');
  await page.mouse.move(1438, 300);
  await expect(world).toHaveAttribute('data-mode', 'manual');
  await page.mouse.move(1300, 20);
  const stopped = await world.getAttribute('data-camera-x');
  await page.waitForTimeout(250);
  expect(await world.getAttribute('data-camera-x')).toBe(stopped);
  const before = await state(page);
  await page.getByTestId('prototype-fire').focus();
  await page.keyboard.down('Space'); await page.waitForTimeout(150);
  await page.keyboard.press('Escape'); await page.keyboard.up('Space');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await state(page)).turn).toBe(before.turn);
  expect((await state(page)).phase).toBe('acting');
  await page.getByRole('button', { name: '対戦に戻る' }).click();
  await expect(page.getByTestId('prototype-fire')).toBeEnabled();
});

test('move, aim and fire use the existing simulation', async ({ page }) => {
  await open(page);
  const before = await state(page);
  await page.keyboard.press('d');
  expect((await state(page)).x).toBeGreaterThan(before.x!);
  await page.keyboard.press('ArrowUp');
  expect((await state(page)).elevation).toBe(before.elevation! + 1);
  const fire = page.getByTestId('prototype-fire');
  const rect = (await fire.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down(); await page.waitForTimeout(300); await page.mouse.up();
  await expect.poll(async () => (await state(page)).phase).not.toBe('acting');
  await expect(page.getByTestId('camera-world')).toHaveAttribute('data-mode', 'shot');
  await expect.poll(async () => (await state(page)).turn, { timeout: 25000 }).toBeGreaterThan(before.turn);
});

for (const [width, height] of [[667, 375], [844, 390], [1440, 900]]) {
  test(`HUD and art fit ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: width!, height: height! });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    for (const label of ['左へ移動', '右へ移動', '角度を下げる', '角度を上げる', '発射']) {
      const box = (await page.getByRole('button', { name: label, exact: true }).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width!);
      expect(box.y + box.height).toBeLessThanOrEqual(height!);
    }
    await page.screenshot({ path: `../../docs/design/previews/camera-prototype/${width}x${height}.png` });
    expect(errors).toEqual([]);
  });
}

test('touch swipe only pans; pointer cancellation and rotation never fire', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await open(page);
  const client = await context.newCDPSession(page), before = await state(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 550, y: 160 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 300, y: 160 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('camera-world')).toHaveAttribute('data-mode', 'manual');
  expect(await state(page)).toEqual(before);
  const box = (await page.getByTestId('prototype-fire').boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(150);
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect((await state(page)).phase).toBe('acting');
  expect((await state(page)).turn).toBe(before.turn);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.setViewportSize({ width: 390, height: 844 });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByText('横向きでプレイしよう')).toBeVisible();
  expect((await state(page)).turn).toBe(before.turn);
  expect((await state(page)).phase).toBe('acting');
  await context.close();
});

test('shift arrows pan without changing aim, including reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  const before = await state(page);
  await page.keyboard.down('Shift'); await page.keyboard.down('ArrowRight');
  await expect(page.getByTestId('camera-world')).toHaveAttribute('data-mode', 'manual');
  await page.keyboard.up('ArrowRight'); await page.keyboard.up('Shift');
  expect(await state(page)).toEqual(before);
  await page.getByRole('button', { name: '手番へ戻る' }).click();
  await expect(page.getByTestId('camera-world')).toHaveAttribute('data-mode', 'actor');
});

test('ordinary practice still loads the original renderer', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByTestId('solo').click();
  await expect(page.locator('.game-root .map-area canvas')).toBeVisible();
  await expect.poll(async () => (await state(page)).phase).toBe('acting');
  await expect(page.locator('.kp-root')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('released drag coasts briefly and settles without changing the tank', async ({ page }) => {
  await open(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const world = page.getByTestId('camera-world'), before = await state(page);
  const x = Number(await world.getAttribute('data-camera-x')), direction = x > 200 ? 1 : -1;
  await page.mouse.move(650, 350); await page.mouse.down();
  for (let i = 1; i <= 4; i++) {
    await page.mouse.move(650 + direction * i * 20, 350);
    await page.clock.runFor(16);
  }
  const released = Number(await world.getAttribute('data-camera-x'));
  await page.mouse.up(); await page.clock.runFor(100);
  const coasted = Number(await world.getAttribute('data-camera-x'));
  expect((coasted - released) * -direction).toBeGreaterThan(0);
  await page.clock.runFor(350);
  const settled = await world.getAttribute('data-camera-x');
  await page.clock.runFor(100);
  expect(await world.getAttribute('data-camera-x')).toBe(settled);
  expect(await state(page)).toEqual(before);
});

test('camera parameters apply immediately, persist and reset on mobile', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '設定を開く' }).click();
  const speed = page.locator('#camera-speed'), inertia = page.locator('#camera-inertia');
  await speed.focus(); await page.keyboard.press('Home');
  for (let i = 0; i < 35; i++) await page.keyboard.press('ArrowRight');
  await inertia.focus(); await page.keyboard.press('Home');
  await expect(speed).toHaveValue('2'); await expect(inertia).toHaveValue('0');
  await page.getByRole('button', { name: '対戦に戻る' }).click();
  await page.clock.install(); await page.clock.pauseAt(new Date());
  const world = page.getByTestId('camera-world');
  const x = Number(await world.getAttribute('data-camera-x')), direction = x > 200 ? 1 : -1;
  await page.mouse.move(650, 350); await page.mouse.down();
  await page.mouse.move(650 + direction * 90, 350); await page.clock.runFor(16);
  await page.mouse.up(); await page.clock.runFor(500);
  expect(Math.abs(Number(await world.getAttribute('data-camera-x')) - x)).toBeCloseTo(20, 0);
  await page.clock.resume();
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  await expect(world).toHaveAttribute('data-loaded', 'true');
  await page.getByRole('button', { name: '設定を開く' }).click();
  await expect(speed).toHaveValue('2'); await expect(inertia).toHaveValue('0');
  await page.getByRole('button', { name: 'カメラを初期値に戻す' }).click();
  await expect(speed).toHaveValue('1'); await expect(inertia).toHaveValue('320');
  await speed.scrollIntoViewIfNeeded();
  expect((await speed.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: 'test-results/camera-settings-mobile.png' });
  await page.getByRole('button', { name: '対戦に戻る' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
