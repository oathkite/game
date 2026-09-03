import { expect, test, type Page } from "@playwright/test";

// 設計書 04 の 4.5 と 09 の 9.3.1。対戦中の再読み込みからの復帰と、観戦者の入室。

const view = (page: Page) =>
  page.evaluate(() => {
    const v = window.__fortress?.getView();
    return v && v.players ? { phase: v.phase, turnNumber: v.turnNumber, mySeat: v.mySeat, currentSeat: v.currentSeat, xs: v.players.map((p) => p.x) } : null;
  });

const waitView = async (page: Page, pred: (v: NonNullable<Awaited<ReturnType<typeof view>>>) => boolean, timeout = 20_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const v = await view(page);
    if (v && pred(v)) return v;
    await page.waitForTimeout(100);
  }
  throw new Error("条件が満たされなかった");
};

const setup = async (page: Page, nickname: string, colorIndex: number): Promise<void> => {
  await page.goto("/");
  await page.getByLabel("nickname").fill(nickname);
  await page.getByRole("radio", { name: /^主色/ }).nth(colorIndex).click();
  await page.getByTestId("enter-lobby").click();
  await expect(page.getByTestId("lobby")).toBeVisible();
};

test("対戦中に再読み込みしても席と手番が復元され、観戦者は操作なしで同じ盤面を見る", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const ctxS = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const s = await ctxS.newPage();

  await setup(a, "alice", 0);
  await setup(b, "bob", 4);
  await a.getByTestId("create-room").click();
  const code = (await a.getByTestId("room-code").textContent()) ?? "";
  await b.getByLabel("room code").fill(code);
  await b.getByTestId("join-code").click();
  await b.getByTestId("ready").click();
  await expect(a.getByTestId("member-1")).toContainText("READY");
  await a.getByTestId("start").click();

  const first = await waitView(a, (v) => v.turnNumber === 1);
  const shooter = first.currentSeat === first.mySeat ? a : b;
  await waitView(shooter, (v) => v.phase === "acting");

  // 手番側が数歩動いてから再読み込みする。席は接続トークンで取り戻し、手番と地形はサーバーから復元される
  await shooter.keyboard.down("ArrowRight");
  await shooter.waitForTimeout(250);
  await shooter.keyboard.up("ArrowRight");
  const before = await view(shooter);
  await shooter.reload();
  const restored = await waitView(shooter, (v) => v.turnNumber === 1 && v.phase === "acting");
  expect(restored.mySeat).toBe(before?.mySeat);
  expect(restored.currentSeat).toBe(before?.currentSeat);
  // 移動はサーバーに届いていないので、位置はターン開始時に戻る
  expect(restored.xs).toEqual(first.xs);

  // 観戦者はロビーの一覧から入り、席なしで同じターンを見る
  await setup(s, "spec", 2);
  await s.getByRole("button", { name: "観戦" }).first().click();
  const spectator = await waitView(s, (v) => v.turnNumber === 1);
  expect(spectator.mySeat).toBeNull();
  expect(spectator.phase).toBe("waiting");
  expect(spectator.xs).toEqual(first.xs);
  await expect(s.getByTestId("fire")).toBeDisabled();

  // 観戦者の入室で手番側の状態は変わらない
  const after = await view(shooter);
  expect(after?.phase).toBe("acting");
  expect(after?.turnNumber).toBe(1);

  // 2 人目の観戦者。手番側が降参すると観戦者にもリザルトが出る
  const ctxS2 = await browser.newContext();
  const s2 = await ctxS2.newPage();
  await setup(s2, "spec2", 3);
  await s2.getByRole("button", { name: "観戦" }).first().click();
  await waitView(s2, (v) => v.turnNumber === 1);
  await shooter.getByRole("button", { name: "降参", exact: true }).click();
  await shooter.getByRole("button", { name: "降参する" }).click();
  await expect(s.getByTestId("result")).toBeVisible();
  await expect(s2.getByTestId("result")).toBeVisible();
  await expect(s.getByTestId("result")).toContainText("降参");
  // 観戦者がリザルトを閉じると部屋の画面に戻り、観戦者数が 2 と表示される
  await s.getByTestId("result-close").click();
  await expect(s.getByTestId("room")).toBeVisible();
  await expect(s.getByTestId("room")).toContainText("観戦 2 人");
  await ctxS2.close();

  await ctxA.close();
  await ctxB.close();
  await ctxS.close();
});
