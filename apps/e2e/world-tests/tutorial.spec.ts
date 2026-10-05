import { expect, test, type Page } from "@playwright/test";
import { armed, lobby } from "./practiceFlow";

// 初回の「はじめる」はチュートリアルへ入る（設計書 44）。この spec だけ保存が空の状態で始める
test.use({ storageState: { cookies: [], origins: [] } });

const guide = (page: Page) => page.locator(".tutorial-guide");
/** 1回押すごとに角度は1度、移動は1歩だけ変わる */
const press = async (page: Page, key: string, times: number): Promise<void> => {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
};
/** power で撃ち、再生が終わって、次を撃てるか次の手順 next へ進むまで待つ。
 * 長押しの時間でパワーが決まるので、practice.spec.ts と同じく偽の時計で押している時間を固定し、マシンの負荷でパワーがずれないようにする */
const shoot = async (page: Page, power: number, next: string): Promise<void> => {
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
  await page.keyboard.down("Space");
  await page.clock.runFor(power * 15 + 3);
  await page.keyboard.up("Space");
  await page.clock.resume();
  // デスクトップには発射のボタンが無いので、発射と同じ条件で押せる武器のボタンで見る
  await expect(armed(page)).toBeDisabled();
  // 操作の手順へ進めば武器も押せるので、どちらか 1 つ以上が見つかるまで待つ
  await expect(page.locator(`.tutorial-step-${next}, .battle-weapons > button:first-child:enabled`)).not.toHaveCount(0, { timeout: 20000 });
};

const throughControls = async (page: Page): Promise<void> => {
  await expect(guide(page)).toContainText("戦車の動かし方を練習しよう", { timeout: 20000 });
  await expect(page.getByRole("button", { name: "次へ", exact: true })).toBeFocused();
  // 「次へ」に焦点がある間の Space はボタンの操作にだけ効き、発射しない
  await page.keyboard.press("Space");
  await expect(guide(page)).toContainText("砲の角度を変えられます");
  // 上の中央にはチャレンジの面の名前と残りの数を出さない
  await expect(page.locator(".challenge-status")).toHaveCount(0);
  // デスクトップには ▲▼◀▶ のボタンが無いので、キーだけを書く
  await expect(page.locator(".battle-dpad")).toHaveCount(0);
  await expect(guide(page)).not.toContainText("▲▼");
  // 操作を促す手順には「次へ」も「スキップ」も無い
  await expect(guide(page).getByRole("button")).toHaveCount(0);
  // 角度は上げるだけ、移動は右だけでは進まない。促していない武器の切り替えでも進まない
  await press(page, "KeyE", 1);
  await press(page, "ArrowUp", 3);
  await expect(guide(page)).toContainText("砲の角度を変えられます");
  await press(page, "ArrowDown", 1);
  await expect(guide(page)).toContainText("戦車が移動して");
  await press(page, "ArrowRight", 2);
  await expect(guide(page)).toContainText("戦車が移動して");
  await press(page, "ArrowLeft", 1);
  await expect(guide(page)).toContainText("武器を切り替えられます");
  await press(page, "KeyQ", 1);
  await expect(guide(page)).toContainText("押し続けるとパワーがたまり");
  // 的はまだ無いので、どこへ撃ってもよい。左を向いているので左の遠くへ撃つ
  await shoot(page, 90, "memo");
  await expect(guide(page)).toContainText("目安の線を引けます");
  await page.getByTestId("prototype-power").click({ position: { x: 20, y: 10 } });
  await expect(page.locator("[data-power-memo]")).toHaveCount(1);
  await expect(guide(page)).toContainText("右に的が出ました");
};

test("初回は「はじめる」からチュートリアルに入り、促した操作で進んで出撃準備へ出る。2回目はロビーへ直行する", async ({ page }) => {
  test.setTimeout(150000);
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await throughControls(page);
  // 開始位置（x=100）で右を向き、標準砲・46度なら、パワー42〜48で当たる（単体テストの TUTORIAL_SOLUTION）。
  // いまは x=101 で左向きなので、1歩行き過ぎてから右へ戻る。角度は 47 度
  await press(page, "ArrowLeft", 2);
  await press(page, "ArrowRight", 1);
  await press(page, "ArrowDown", 1);
  await shoot(page, 45, "wind");
  await expect(guide(page)).toContainText("風が吹き始めました");
  await expect(page.locator(".tutorial-step-wind .battle-wind")).toContainText("右向きの風 6");
  await shoot(page, 33, "timer");
  await expect(guide(page)).toContainText("20秒の制限時間");
  await expect(page.locator(".battle-floating-timer")).toHaveText(/^\d+$/);
  await expect(page.getByRole("button", { name: "次へ", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  // アイテムは手順ごとに 1 つずつ、その手順のアイテムだけを押せる
  await expect(guide(page)).toContainText("ダブルシュートを選んで撃つと");
  const double = page.getByRole("button", { name: "ダブルシュート", exact: true });
  await expect(page.getByRole("button", { name: "テレポート", exact: true })).toBeDisabled();
  await double.click();
  await expect(double).toHaveAttribute("aria-pressed", "true");
  await shoot(page, 40, "teleport");
  await expect(guide(page)).toContainText("テレポートを選んで撃つと");
  await expect(page.getByRole("button", { name: "ダブルシュート（使用済み）" })).toBeDisabled();
  await page.getByRole("button", { name: "テレポート", exact: true }).click();
  await shoot(page, 40, "done");
  await expect(guide(page)).toContainText("チュートリアル完了");
  await expect(page.getByRole("button", { name: "テレポート（使用済み）" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "出撃準備へ進む", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(lobby(page)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(lobby(page)).toBeVisible();
});

test("メニューからやめると、初回は出撃準備へ、プラクティスから入ったときはプラクティスへ戻る", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(guide(page)).toContainText("戦車の動かし方を練習しよう", { timeout: 20000 });
  await expect(guide(page).getByRole("button", { name: "スキップ" })).toHaveCount(0);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("dialog", { name: "チュートリアル" }).getByRole("button", { name: "チュートリアルをやめる", exact: true }).click();
  await expect(lobby(page)).toBeVisible();
  await page.getByRole("button", { name: "プラクティス", exact: true }).click();
  await page.getByRole("button", { name: "チュートリアル", exact: true }).click();
  await expect(guide(page)).toContainText("戦車の動かし方を練習しよう", { timeout: 20000 });
  await page.keyboard.press("Escape");
  const menu = page.getByRole("dialog", { name: "チュートリアル" });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "チュートリアルをやめる", exact: true }).click();
  await expect(page.locator(".practice-header h1")).toHaveText("プラクティス");
});

test("タッチ端末ではキーを書かずに画面のボタンで案内する", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ja-JP", hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect(guide(page)).toContainText("戦車の動かし方を練習しよう", { timeout: 20000 });
  await page.getByRole("button", { name: "次へ", exact: true }).tap();
  await expect(guide(page)).toHaveText(/画面左下の▲▼で、砲の角度を変えられます/);
  await expect(guide(page)).not.toContainText("キー");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "角度を上げる" }).tap();
  await expect(guide(page)).toHaveText(/画面左下の▲▼で/);
  await page.getByRole("button", { name: "角度を下げる" }).tap();
  await expect(guide(page)).toContainText("◀▶で、戦車が移動して向きも変わります");
  await context.close();
});
