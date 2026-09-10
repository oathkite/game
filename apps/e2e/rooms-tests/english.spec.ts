import { expect, test } from "@playwright/test";
test("English players can join, ready up, inspect diagnostics and finish a quick match", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext({ locale: "en-US" }), browser.newContext({ locale: "en-US" })]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  try {
    for (const page of pages) {
      await page.goto("/");
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.getByRole("button", { name: "Online battle", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Battle rooms", exact: true })).toBeVisible();
      await page.locator(".room-screen").evaluate(element => element.setAttribute("data-before-join", "true"));
      await page.getByRole("button", { name: "Quick play", exact: true }).click();
      await expect(page.getByRole("button", { name: "Ready", exact: true })).toBeVisible();
      await expect(page.locator(".room-screen")).not.toHaveAttribute("data-before-join", "true");
      await expect(page.locator(".room-screen")).toHaveCSS("animation-name", "room-reveal");
    }
    for (const page of pages) await page.getByRole("button", { name: "Ready", exact: true }).click();
    for (const page of pages) await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    const guest = pages[1]!;
    await guest.getByRole("button", { name: "Open settings", exact: true }).click();
    await guest.getByText("Report player", { exact: true }).click();
    await guest.getByRole("button", { name: "Send report", exact: true }).click();
    await expect(guest.getByText("Report received.", { exact: true })).toBeVisible();
    await guest.getByRole("button", { name: "Send report", exact: true }).click();
    await expect(guest.getByText("You have already reported this player.", { exact: true })).toBeVisible();
    await guest.getByText("Match diagnostics", { exact: true }).click();
    await expect(guest.getByRole("textbox", { name: "Match diagnostics", exact: true })).toContainText("keropod-match-diagnostics-v1");
    await guest.getByRole("button", { name: "Surrender", exact: true }).click();
    await expect(pages[0]!.getByRole("heading", { name: /Team (Blue|Red) wins/ })).toBeVisible();
    await expect(pages[0]!.locator("section.network-finished")).toHaveCSS("animation-name", "room-reveal");
    await pages[0]!.emulateMedia({ reducedMotion: "reduce" });
    await expect(pages[0]!.locator("section.network-finished")).toHaveCSS("animation-name", "none");
  } finally { for (const context of contexts) await context.close(); }
});
