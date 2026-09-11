import { test, expect } from "@playwright/test";

test("back from an invited battle preserves the session until confirmed, then surrenders", async ({ browser, baseURL }) => {
  const contexts = await Promise.all([browser.newContext({ locale: "ja-JP" }), browser.newContext({ locale: "ja-JP" })]);
  const [owner, guest] = await Promise.all(contexts.map(context => context.newPage()));
  try {
    await owner!.goto(`${baseURL}/?prototype=world`);
    await owner!.getByRole("button", { name: "はじめる", exact: true }).click();
    await owner!.getByRole("button", { name: "オンライン対戦", exact: true }).click();
    await owner!.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await expect(owner!.getByTestId("room-code")).toHaveText(/^[A-F0-9]{6}$/);
    const code = await owner!.getByTestId("room-code").textContent();
    await guest!.goto(`${baseURL}/?prototype=world&room=${code}`);
    await guest!.getByRole("button", { name: "部屋に参加", exact: true }).click();
    await expect(owner!.getByLabel("参加者2のチーム")).toBeVisible();
    await owner!.getByLabel("参加者1のチーム").selectOption("t0");
    await guest!.getByLabel("参加者2のチーム").selectOption("t1");
    await owner!.getByRole("button", { name: "準備完了", exact: true }).click();
    await guest!.getByRole("button", { name: "準備完了", exact: true }).click();
    await owner!.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of [owner!, guest!]) await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    const token = await guest!.evaluate(() => sessionStorage.getItem("keropod.room-token"));
    await guest!.evaluate(() => history.back());
    const dialog = guest!.getByRole("dialog", { name: "ロビーへ戻りますか？" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("降参扱い");
    await guest!.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(await guest!.evaluate(() => sessionStorage.getItem("keropod.room-token"))).toBe(token);
    await expect(owner!.getByRole("heading", { name: /チームの勝利/ })).toHaveCount(0);
    await guest!.evaluate(() => history.back());
    await dialog.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
    await expect(guest!.getByRole("heading", { name: "出発の準備" })).toBeVisible();
    expect(await guest!.evaluate(() => sessionStorage.getItem("keropod.room-token"))).toBeNull();
    await expect(owner!.getByRole("heading", { name: "青チームの勝利", exact: true })).toBeVisible();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test("back from a waiting room releases the seat and clears the resume token", async ({ browser, baseURL }) => {
  const contexts = await Promise.all([browser.newContext({ locale: "ja-JP" }), browser.newContext({ locale: "ja-JP" })]);
  const [owner, guest] = await Promise.all(contexts.map(context => context.newPage()));
  try {
    await owner!.goto(`${baseURL}/?prototype=world`);
    await owner!.getByRole("button", { name: "はじめる", exact: true }).click();
    await owner!.getByRole("button", { name: "オンライン対戦", exact: true }).click();
    await owner!.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await expect(owner!.getByTestId("room-code")).toHaveText(/^[A-F0-9]{6}$/);
    const code = await owner!.getByTestId("room-code").textContent();
    await guest!.goto(`${baseURL}/?prototype=world&room=${code}`);
    await guest!.getByRole("button", { name: "部屋に参加", exact: true }).click();
    await expect(owner!.locator(".room-members li")).toHaveCount(2);
    await guest!.evaluate(() => history.back());
    await expect(guest!.getByRole("heading", { name: "出発の準備" })).toBeVisible();
    await expect(owner!.locator(".room-members li")).toHaveCount(1);
    expect(await guest!.evaluate(() => sessionStorage.getItem("keropod.room-token"))).toBeNull();
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
