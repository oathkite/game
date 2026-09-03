import { expect, test, type Page } from "@playwright/test";

// 設計書 07 の 7.5「client のテスト」。2 つのブラウザを開いて 1 戦を通す。

type Snapshot = {
  readonly phase: string;
  readonly turnNumber: number;
  readonly currentSeat: 0 | 1;
  readonly mySeat: 0 | 1 | null;
  readonly xs: readonly number[];
  readonly hp: readonly number[];
  readonly mismatches: number;
  readonly ops: number;
};

const snapshot = (page: Page): Promise<Snapshot | null> =>
  page.evaluate(() => {
    const v = window.__fortress?.getView();
    if (!v || !v.players) return null;
    return {
      phase: v.phase,
      turnNumber: v.turnNumber,
      currentSeat: v.currentSeat,
      mySeat: v.mySeat,
      xs: v.players.map((p) => p.x),
      hp: v.players.map((p) => p.hp),
      mismatches: v.mismatches,
      ops: v.mask ? v.mask.cells.reduce((a, b) => a + b, 0) : 0,
    };
  });

const waitFor = async (page: Page, pred: (s: Snapshot) => boolean, timeout = 30_000): Promise<Snapshot> => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const s = await snapshot(page);
    if (s && pred(s)) return s;
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

test("2 つのブラウザで部屋を作って入り、撃って、降参で決着し、部屋に戻る", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  for (const [name, page] of [["A", a], ["B", b]] as const) {
    page.on("pageerror", (e) => console.log(`${name} pageerror`, e.stack ?? e.message));
    page.on("console", (m) => {
      if (m.type() === "error") console.log(`${name} console`, m.text().slice(0, 300));
    });
  }

  await setup(a, "alice", 0);
  await setup(b, "bob", 4);

  await a.getByTestId("create-room").click();
  const code = (await a.getByTestId("room-code").textContent()) ?? "";
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  await b.getByLabel("room code").fill(code);
  await b.getByTestId("join-code").click();
  await expect(b.getByTestId("room")).toBeVisible();
  await expect(a.getByTestId("member-1")).toContainText("bob");

  await b.getByTestId("ready").click();
  await expect(a.getByTestId("member-1")).toContainText("READY");
  await a.getByTestId("start").click();

  const first = await waitFor(a, (s) => s.phase === "acting" || s.phase === "waiting");
  await waitFor(b, (s) => s.turnNumber === 1);
  const shooter = first.currentSeat === first.mySeat ? a : b;
  const other = shooter === a ? b : a;
  await waitFor(shooter, (s) => s.phase === "acting");

  // 手番の表示。手番側には「あなたの番」、相手には「相手の番」が出る
  await expect(shooter.getByTestId("turn-label")).toHaveText("あなたの番");
  await expect(other.getByTestId("turn-label")).toHaveText("相手の番");

  // 手番側が移動して撃つ。押している時間でパワーが決まる
  await shooter.keyboard.down("ArrowRight");
  await shooter.waitForTimeout(300);
  await shooter.keyboard.up("ArrowRight");
  await shooter.keyboard.down("Space");
  await shooter.waitForTimeout(700);
  await shooter.keyboard.up("Space");

  const afterA = await waitFor(a, (s) => s.turnNumber === 2);
  const afterB = await waitFor(b, (s) => s.turnNumber === 2);
  expect(afterA.mismatches).toBe(0);
  expect(afterB.mismatches).toBe(0);
  expect(afterA.xs).toEqual(afterB.xs);
  expect(afterA.hp).toEqual(afterB.hp);
  expect(afterA.ops).toEqual(afterB.ops);
  // 着弾していれば地形が削れている（マップ外に消えた場合は削れない）
  expect(afterA.ops).toBeLessThanOrEqual(first.ops);

  // 入力がなければ射撃は起きず、制限時間の 20 秒と猶予 1 秒でパスになる
  const idleStart = Date.now();
  const passed = await waitFor(other, (s) => s.turnNumber === 3, 30_000);
  expect(Date.now() - idleStart).toBeGreaterThan(15_000);
  expect(passed.xs).toEqual(afterA.xs);
  expect(passed.hp).toEqual(afterA.hp);
  expect(passed.ops).toEqual(afterA.ops);

  // 降参で決着し、両者にリザルトが出る
  await a.getByRole("button", { name: "降参", exact: true }).click();
  await a.getByRole("button", { name: "降参する" }).click();
  await expect(a.getByTestId("result")).toBeVisible();
  await expect(b.getByTestId("result")).toBeVisible();
  await expect(b.getByTestId("result")).toContainText("bob");
  await expect(b.getByTestId("result")).toContainText("降参");

  // 全員がリザルトを閉じると部屋は募集中に戻る
  await a.getByTestId("result-close").click();
  await b.getByTestId("result-close").click();
  await expect(a.getByTestId("room")).toBeVisible();
  await expect(b.getByTestId("room")).toBeVisible();
  await expect(b.getByTestId("ready")).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});
