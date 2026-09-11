import { expect, test } from "@playwright/test";
test("a participant creates an expiring link that another browser can join", async ({ browser, baseURL }) => {
  const contexts = await Promise.all([browser.newContext({ locale: "ja-JP" }), browser.newContext({ locale: "ja-JP" })]);
  const [owner, guest] = await Promise.all(contexts.map(context => context.newPage()));
  try {
    await owner!.goto(`${baseURL}/?prototype=world`);
    await owner!.getByRole("button", { name: "はじめる", exact: true }).click();
    await owner!.getByRole("button", { name: "オンライン対戦", exact: true }).click();
    await owner!.getByRole("button", { name: "部屋を作る", exact: true }).click();
    const code = owner!.getByTestId("room-code"); await expect(code).toHaveText(/^[A-F0-9]{6}$/);
    await owner!.getByRole("button", { name: "招待リンク", exact: true }).click();
    const link = owner!.getByRole("textbox", { name: "招待リンク", exact: true });
    await expect(link).toHaveValue(/#invite=[a-f0-9-]{36}$/);
    await expect(owner!.getByText("有効期限", { exact: false })).toBeVisible();
    await guest!.goto(await link.inputValue());
    await guest!.getByRole("button", { name: "部屋に参加", exact: true }).click();
    await expect(guest!.getByTestId("room-code")).toHaveText((await code.textContent())!);
    await expect(owner!.locator(".room-members li")).toHaveCount(2);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
