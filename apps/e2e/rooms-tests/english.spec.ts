import { expect, test } from "@playwright/test";
// クイック参加の入口は画面から外れている（quick.spec.ts の fixme を参照）ので、部屋を作ってコードで入る。
test("English players can join, ready up, inspect diagnostics and finish a custom match", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext({ locale: "en-US" }), browser.newContext({ locale: "en-US" })]);
  const [owner, guest] = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const page of [owner!, guest!]) {
      await page.goto("/");
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.getByRole("button", { name: "Deploy", exact: true }).click();
      await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeEnabled();
    }
    await owner!.getByRole("button", { name: "Create room", exact: true }).click();
    await owner!.getByRole("dialog", { name: "Create room" }).getByRole("button", { name: "Create room", exact: true }).click();
    const code = (await owner!.getByTestId("room-code").textContent())!;
    await guest!.locator(".room-screen").evaluate(element => element.setAttribute("data-before-join", "true"));
    await guest!.getByRole("button", { name: "Find rooms", exact: true }).click();
    await guest!.getByRole("dialog", { name: "Find rooms" }).getByLabel("Room code", { exact: true }).fill(code);
    await guest!.getByRole("dialog", { name: "Find rooms" }).getByRole("button", { name: "Close", exact: true }).click();
    await guest!.locator(".public-rooms li").filter({ hasText: code }).getByRole("button", { name: "Join room", exact: true }).click();
    await expect(guest!.getByRole("button", { name: "Ready", exact: true })).toBeVisible();
    await expect(guest!.locator(".room-screen")).not.toHaveAttribute("data-before-join", "true");
    await expect(guest!.locator(".room-screen")).toHaveCSS("animation-name", "room-reveal");
    await guest!.getByRole("button", { name: "Ready", exact: true }).click();
    await expect(guest!.getByRole("button", { name: "Ready", exact: true })).toHaveAttribute("aria-pressed", "true");
    await owner!.getByRole("button", { name: "Start battle", exact: true }).click();
    for (const page of [owner!, guest!]) await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    await guest!.getByRole("button", { name: "Open settings", exact: true }).click();
    await expect(guest!.locator("dialog").getByText(/Network latency \d+ ms/)).toBeVisible();
    await guest!.getByText("Report player", { exact: true }).click();
    await guest!.getByRole("button", { name: "Send report", exact: true }).click();
    await expect(guest!.getByText("Report received.", { exact: true })).toBeVisible();
    await guest!.getByRole("button", { name: "Send report", exact: true }).click();
    await expect(guest!.getByText("You have already reported this player.", { exact: true })).toBeVisible();
    await guest!.getByText("Match diagnostics", { exact: true }).click();
    await expect(guest!.getByRole("textbox", { name: "Match diagnostics", exact: true })).toContainText("keropod-match-diagnostics-v1");
    await guest!.getByRole("button", { name: "Surrender", exact: true }).click();
    await expect(owner!.getByRole("heading", { name: "Victory", exact: true })).toBeVisible();
    await expect(owner!.locator("section.network-finished")).toHaveCSS("animation-name", "room-reveal");
    await owner!.emulateMedia({ reducedMotion: "reduce" });
    await expect(owner!.locator("section.network-finished")).toHaveCSS("animation-name", "none");
  } finally { for (const context of contexts) await context.close(); }
});
