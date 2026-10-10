import { expect, test } from "@playwright/test";
import { armed } from "../world-tests/practiceFlow";

test("練習から出撃準備に戻り、部屋作成・退出ができる", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ locale: "ja-JP" });
  const owner = await context.newPage();
  try {
    await owner.goto(`${baseURL}/`);
    await owner.getByRole("button", { name: "はじめる", exact: true }).click();
    await owner.getByRole("button", { name: "プラクティス", exact: true }).click();
    await owner.getByRole("button", { name: "ターゲットチャレンジ", exact: true }).click();
    await owner.getByRole("button", { name: "ステージ1をはじめる" }).click();
    // 開幕の俯瞰が終わってから撃てる状態になる（設計書 37）。デスクトップに発射のボタンは無いので、
    // 発射と同じ条件で押せるようになる武器のボタンで見る
    await expect(owner.getByTestId("camera-world")).toHaveAttribute("data-opening", "false", { timeout: 15000 });
    await expect(armed(owner)).toBeEnabled();
    await owner.getByRole("button", { name: "設定を開く", exact: true }).click();
    await owner.getByRole("button", { name: "ステージ選択へ戻る" }).click();
    await owner.getByRole("button", { name: "プラクティスへ戻る" }).click();
    await owner.getByRole("button", { name: "出撃準備へ戻る" }).click();
    await owner.getByRole("button", { name: "出撃", exact: true }).click();
    await owner.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await owner.getByRole("dialog", { name: "部屋を作る" }).getByRole("button", { name: "部屋を作る", exact: true }).click();
    await expect(owner.getByTestId("room-code")).toHaveText(/^[A-F0-9]{6}$/);
    await owner.goBack();
    await owner.getByRole("button", { name: "出撃準備", exact: true }).click();
    await expect(owner.getByRole("button", { name: "プラクティス", exact: true })).toBeVisible();
    expect(await owner.evaluate(() => sessionStorage.getItem("keropod.room-token"))).toBeNull();
  } finally { await context.close(); }
});
