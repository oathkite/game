import { expect, test, type Locator, type Page } from "@playwright/test";

const inView = async (button: Locator) => {
  await expect(button).toBeInViewport({ ratio: 1 });
  const box = await button.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
};

const screenshot = async (page: Page, name: string) => {
  expect(await page.locator(".menu-shell").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  const panes = page.locator(".pane");
  for (const pane of await panes.all()) {
    expect(await pane.evaluate((el) => getComputedStyle(el).overflowY !== "visible" || el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  }
  await page.screenshot({ path: `test-results/${name}-${page.viewportSize()?.width}.png` });
};

const setup = async (page: Page, nickname: string) => {
  await page.goto("/");
  await inView(page.getByTestId("enter-lobby"));
  await inView(page.getByTestId("solo"));
  await page.getByLabel("nickname").fill(nickname);
  await screenshot(page, "setup");
  await page.getByTestId("enter-lobby").click();
};

const checkMapPicker = async (page: Page, label: string) => {
  await page.getByRole("button", { name: label, exact: true }).click();
  await inView(page.getByRole("button", { name: "戻る", exact: true }));
  await page.getByRole("button", { name: "浮島", exact: true }).click();
  await expect(page.getByTestId("map-picker")).toBeHidden();
  await expect(page.getByRole("button", { name: label, exact: true })).toContainText("浮島");
};

const viewports = [
  { width: 360, height: 640 }, { width: 390, height: 844 },
  { width: 667, height: 375 }, { width: 844, height: 390 }, { width: 1400, height: 800 },
];

for (const viewport of viewports) {
  test(`主要操作がスクロールなしで使える ${viewport.width}x${viewport.height}`, async ({ page, browser }) => {
    test.setTimeout(30_000);
    await page.setViewportSize(viewport);
    await setup(page, "名前が長いプレイヤー");
    await inView(page.getByTestId("create-room"));
    await inView(page.getByTestId("join-code"));
    await inView(page.getByRole("button", { name: "設定へ戻る" }));
    await screenshot(page, "lobby");
    await checkMapPicker(page, "map");
    await page.getByTestId("create-room").click();
    await inView(page.getByTestId("start"));
    await inView(page.getByTestId("leave"));
    await inView(page.getByRole("button", { name: "名前、色、武器を変える" }));
    await screenshot(page, "room");
    const guest = await browser.newPage({ viewport });
    await setup(guest, "参加者");
    if (viewport.width === 1400) {
      await guest.getByTestId("room-list").getByRole("button", { name: "入る", exact: true }).click();
    } else {
      await guest.getByLabel("room code").fill(await page.getByTestId("room-code").innerText());
      await guest.getByTestId("join-code").click();
    }
    await inView(guest.getByTestId("ready"));
    await inView(guest.getByTestId("leave"));
    await guest.getByRole("button", { name: "名前、色、武器を変える" }).click();
    await guest.getByRole("radio", { name: /^主色/ }).nth(4).click();
    await guest.getByTestId("enter-lobby").click();
    await guest.getByTestId("ready").click();
    await expect(page.getByTestId("start")).toBeEnabled();
    await screenshot(guest, "room-guest");
    await page.getByRole("button", { name: "解散", exact: true }).click();
    await guest.close();
  });
}
