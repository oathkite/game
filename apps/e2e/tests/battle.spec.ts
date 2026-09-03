import { expect, test, type Page } from "@playwright/test";

// 設計書 01 の 1.2 と 1.7。両者が撃ち合い、HP かリングアウトで決着し、両者にリザルトが出るまでを通す。

type Snap = { readonly phase: string; readonly turnNumber: number; readonly currentSeat: 0 | 1; readonly mySeat: 0 | 1 | null; readonly hp: readonly number[] };

const snap = (page: Page): Promise<Snap | null> =>
  page.evaluate(() => {
    const v = window.__fortress?.getView();
    return v && v.players ? { phase: v.phase, turnNumber: v.turnNumber, currentSeat: v.currentSeat, mySeat: v.mySeat, hp: v.players.map((p) => p.hp) } : null;
  });

const setup = async (page: Page, nickname: string, colorIndex: number): Promise<void> => {
  await page.goto("/");
  await page.getByLabel("nickname").fill(nickname);
  await page.getByRole("radio", { name: /^主色/ }).nth(colorIndex).click();
  await page.getByTestId("enter-lobby").click();
  await expect(page.getByTestId("lobby")).toBeVisible();
};

/** 手番側が、相手にダメージが入る照準を探して撃つ。仰角は矢印キー、パワーは押している時間で作る */
const fireBest = async (page: Page): Promise<boolean> => {
  const aim = await page.evaluate(() => window.__fortress?.aim() ?? null);
  const current = await snap(page);
  if (!aim || !current) return false;
  const elevation = await page.evaluate(() => window.__fortress?.getView().control?.elevation ?? 45);
  const key = aim.elevation > elevation ? "ArrowUp" : "ArrowDown";
  for (let i = 0; i < Math.abs(aim.elevation - elevation); i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(20);
  }
  await page.keyboard.down("Space");
  await page.waitForTimeout(aim.power * 15);
  await page.keyboard.up("Space");
  return true;
};

test("両者が撃ち合って決着し、両者にリザルトが出る", async ({ browser }) => {
  test.setTimeout(600_000);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await setup(a, "alice", 0);
  await setup(b, "bob", 4);
  await a.getByTestId("create-room").click();
  const code = (await a.getByTestId("room-code").textContent()) ?? "";
  await b.getByLabel("room code").fill(code);
  await b.getByTestId("join-code").click();
  await b.getByTestId("ready").click();
  await expect(a.getByTestId("member-1")).toContainText("READY");
  await a.getByTestId("start").click();

  let hits = 0;
  const deadline = Date.now() + 480_000;
  while (Date.now() < deadline) {
    const sa = await snap(a);
    const sb = await snap(b);
    if (!sa || !sb) {
      await a.waitForTimeout(200);
      continue;
    }
    if (sa.phase === "finished" || sb.phase === "finished") break;
    const shooter = sa.phase === "acting" ? a : sb.phase === "acting" ? b : null;
    if (!shooter) {
      await a.waitForTimeout(200);
      continue;
    }
    const before = (await snap(shooter)) as Snap;
    const fired = await fireBest(shooter);
    if (!fired) {
      // 当てられる照準がなければパスを待つ
      await shooter.waitForTimeout(500);
      continue;
    }
    // 結果の再生が終わるまで待つ
    const t0 = Date.now();
    while (Date.now() - t0 < 15_000) {
      const s = await snap(shooter);
      if (s && (s.turnNumber > before.turnNumber || s.phase === "finished")) break;
      await shooter.waitForTimeout(100);
    }
    const after = (await snap(shooter)) as Snap;
    const opp = before.mySeat === 0 ? 1 : 0;
    if ((after.hp[opp] ?? 100) < (before.hp[opp] ?? 100)) hits++;
  }

  expect(hits).toBeGreaterThan(0);
  await expect(a.getByTestId("result")).toBeVisible({ timeout: 15_000 });
  await expect(b.getByTestId("result")).toBeVisible({ timeout: 15_000 });
  const text = (await a.getByTestId("result").innerText()) ?? "";
  // 決着の理由は HP、リングアウト、ターン上限のどれか。撃ち合いなので誰かの HP は減っている
  expect(text.includes("HP") || text.includes("リングアウト") || text.includes("ターン上限")).toBe(true);
  const fa = await snap(a);
  const fb = await snap(b);
  expect(fa?.hp).toEqual(fb?.hp);
  expect(Math.min(...(fa?.hp ?? [100, 100]))).toBeLessThan(100);
  await ctxA.close();
  await ctxB.close();
});
