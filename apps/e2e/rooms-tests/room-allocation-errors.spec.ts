import { expect, test, type Route } from "@playwright/test";
import { enterRooms } from "./roomFlow";
// 部屋の割り当て（POST /v2/rooms）が断られたときと届かなかったときで、出す文言を分ける（設計書 31 章）。
// ローカルの wrangler の rate limit は当てにできないので、応答は route で差し替える。
const cases: readonly { readonly name: string; readonly reply: (route: Route) => Promise<void>; readonly message: string }[] = [
  { name: "rejected settings", reply: route => route.fulfill({ status: 400, body: "invalid room settings" }), message: "対戦の設定を受け付けられませんでした。設定を変えるか、再読み込みしてから再試行してください。" },
  { name: "rate limit", reply: route => route.fulfill({ status: 429, headers: { "Retry-After": "60" }, body: "allocation rate limit" }), message: "部屋の割り当てが続いたため、一時的に受け付けを止めています。しばらく待ってから再試行してください。" },
  { name: "network failure", reply: route => route.abort("connectionrefused"), message: "対戦サーバーに接続できません。" },
];
for (const { name, reply, message } of cases) {
  test(`room creation shows its own message for ${name}`, async ({ page }, testInfo) => {
    await page.route("**/v2/rooms", route => route.request().method() === "POST" ? reply(route) : route.continue());
    await enterRooms(page);
    await page.getByRole("button", { name: "部屋を作る", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "部屋を作る" });
    await dialog.getByRole("button", { name: "部屋を作る", exact: true }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "部屋を作る", exact: true })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("allocation-error.png") });
  });
}
