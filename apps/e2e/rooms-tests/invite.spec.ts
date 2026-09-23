import { expect, test } from "@playwright/test";
import { createRoom, enterRooms, joinListed, members, presetNickname, readyUp, waitForBattle } from "./roomFlow";
test("invitation skips the title and an independent spectator watches without controls", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext({ locale: "ja-JP" }), browser.newContext({ locale: "ja-JP" }), browser.newContext({ locale: "ja-JP", hasTouch: true, viewport: { width: 844, height: 390 } })]);
  const [a, b, viewer] = await Promise.all(contexts.map(c => c.newPage()));
  const errors: string[] = [];
  try {
    for (const page of [a!, b!, viewer!]) page.on("pageerror", e => errors.push(e.message));
    await enterRooms(a!);
    const code = await createRoom(a!);
    await a!.getByRole("button", { name: "招待リンク", exact: true }).click();
    const link = await a!.getByLabel("招待リンク", { exact: true }).inputValue();
    expect(new URL(link).searchParams.has("token")).toBe(false);
    // 招待リンクはタイトルとロビーを飛ばすので、名前はロビーで保存済みのものを使う。
    await presetNickname(b!, "招待ゲスト");
    await b!.goto(link);
    await expect(b!.getByRole("button", { name: "はじめる", exact: true })).toHaveCount(0);
    await joinListed(b!, code);
    await expect(members(a!).nth(1)).toContainText("招待ゲスト");
    await readyUp(b!);
    await a!.getByRole("button", { name: "対戦開始" }).click();
    await waitForBattle(a!);
    await viewer!.goto(link);
    await viewer!.locator(".public-rooms li").filter({ hasText: code }).getByRole("button", { name: "観戦する", exact: true }).click();
    await expect(viewer!.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    await expect(viewer!.getByRole("status")).toHaveText("観戦中");
    await expect(viewer!.getByRole("button", { name: "発射", exact: true })).toHaveCount(0);
    await viewer!.getByLabel("手動視点を維持").check();
    const actor = await a!.getByRole("button", { name: "標準砲", exact: true }).isEnabled() ? a! : b!;
    await actor.keyboard.down("Space"); await actor.waitForTimeout(350); await actor.keyboard.up("Space");
    await expect(viewer!.getByTestId("phase")).toHaveText("射撃を再生中");
    await expect(viewer!.getByTestId("phase")).toHaveText("操作中", { timeout: 12000 });
    await viewer!.getByRole("button", { name: "設定を開く" }).click();
    await expect(viewer!.getByRole("button", { name: "降参", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { for (const context of contexts) await context.close(); }
});
