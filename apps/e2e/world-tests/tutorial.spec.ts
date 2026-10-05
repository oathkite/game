import { expect, test, type Page } from "@playwright/test";
import { armed, lobby } from "./practiceFlow";

// 初回の「はじめる」はチュートリアルへ入る（設計書 44）。この spec だけ保存が空の状態で始める
test.use({ storageState: { cookies: [], origins: [] } });

const guide = (page: Page) => page.locator(".tutorial-guide");
/** 1回押すごとに角度は1度、移動は1歩だけ変わる */
const press = async (page: Page, key: string, times: number): Promise<void> => {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
};
/** 発射ボタンの長押しと同じく、押している時間でパワーが決まる。再生が終わり、次を撃てるか的を壊して風の説明へ進むまで待ち、撃ったパワーを返す */
const shoot = async (page: Page, ms: number): Promise<number> => {
  await page.keyboard.down("Space");
  await page.waitForTimeout(ms);
  await page.keyboard.up("Space");
  const power = Number(await page.locator(".battle-console").innerText().then(text => text.split("\n")[1]));
  // デスクトップには発射のボタンが無いので、発射と同じ条件で押せる武器のボタンで見る
  await expect(armed(page)).toBeDisabled();
  await expect(page.locator(".tutorial-step-wind, .battle-weapons > button:first-child:enabled")).toHaveCount(1, { timeout: 20000 });
  return power;
};

const throughBasics = async (page: Page): Promise<void> => {
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
  // 促していない操作では進まない
  await press(page, "KeyE", 1);
  await press(page, "ArrowUp", 9);
  await expect(guide(page)).toContainText("砲の角度を変えられます");
  await press(page, "ArrowUp", 1);
  await expect(guide(page)).toContainText("戦車が移動します");
  await press(page, "ArrowRight", 5);
  await expect(guide(page)).toContainText("武器を切り替えられます");
  await press(page, "KeyQ", 1);
  await expect(guide(page)).toContainText("目安の線を引けます");
  // 操作を促す手順には「次へ」も「スキップ」も無い
  await expect(guide(page).getByRole("button")).toHaveCount(0);
  await page.getByTestId("prototype-power").click({ position: { x: 20, y: 10 } });
  await expect(page.locator("[data-power-memo]")).toHaveCount(1);
  await expect(guide(page)).toContainText("押し続けるとパワーがたまり");
  // 的の先の遠くへ外す
  await shoot(page, 1400);
  await expect(guide(page)).toContainText("的を壊してみてください");
};

test("初回は「はじめる」からチュートリアルに入り、促した操作で進んで出撃準備へ出る。2回目はロビーへ直行する", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await throughBasics(page);
  // 開始位置（x=100）で右を向き、標準砲・46度なら、パワー42〜48で当たる（単体テストの TUTORIAL_SOLUTION）。
  // 左へ歩くと左を向くので、1歩行き過ぎてから右へ戻る
  await press(page, "ArrowLeft", 6);
  await press(page, "ArrowRight", 1);
  await press(page, "ArrowDown", 9);
  // 押している時間とパワーの関係は環境で揺れるので、撃ったパワーを見て次の時間を直す（1あたり約15ms）
  let ms = 560;
  for (let attempt = 0; attempt < 5 && !(await page.locator(".tutorial-step-wind").count()); attempt++) {
    const power = await shoot(page, ms);
    ms += (45 - power) * 15;
  }
  // 的を壊したら、対戦で知っておくこと（風、制限時間、アイテム）を「次へ」で読む
  for (const text of ["風のメーター", "20秒の制限時間", "ダブルシュート"]) {
    await expect(guide(page)).toContainText(text);
    await expect(page.getByRole("button", { name: "次へ", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await expect(guide(page)).toContainText("チュートリアル完了");
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
  for (let i = 0; i < 10; i++) await page.getByRole("button", { name: "角度を上げる" }).tap();
  await expect(guide(page)).toContainText("◀▶で、戦車が移動します");
  await context.close();
});
