import { expect, test } from "@playwright/test";
test("another browser sees movement and reloaded actor retains position", async ({ browser }) => {
  const first = await browser.newContext(), second = await browser.newContext();
  const a = await first.newPage(), b = await second.newPage();
  const errors: string[] = [];
  a.on("pageerror", e => errors.push(e.message)); b.on("pageerror", e => errors.push(e.message));
  try {
    await a.goto("/?prototype=network");
    await expect(a.getByTestId("identity")).toHaveText(/^p\d$/);
    const actor = await a.getByTestId("identity").innerText();
    await b.goto("/?prototype=network");
    await expect(b.getByTestId("identity")).toHaveText(/^p\d$/);
    await expect(a.getByRole("button", { name: "右へ1歩" })).toBeEnabled();
    await expect(b.getByRole("button", { name: "右へ1歩" })).toBeDisabled();
    const tank = b.getByTestId(`tank-${actor}`);
    await expect(tank).toBeVisible();
    const x = Number(await tank.getAttribute("data-x"));
    await a.getByRole("button", { name: "右へ1歩" }).click();
    await expect.poll(async () => Number(await tank.getAttribute("data-x"))).toBe(x + 1);
    await a.reload();
    await expect(a.getByTestId("identity")).toHaveText(actor);
    await expect(a.getByTestId(`tank-${actor}`)).toHaveAttribute("data-x", (x + 1).toFixed(3));
    await a.getByRole("button", { name: "右へ1歩" }).click();
    await expect.poll(async () => Number(await tank.getAttribute("data-x"))).toBe(x + 2);
    await a.getByRole("button", { name: "発射", exact: true }).click();
    await expect(b.getByTestId("phase")).toHaveText("射撃を再生中");
    await expect(a.getByRole("button", { name: "右へ1歩" })).toBeDisabled();
    await expect(b.getByTestId("phase")).toHaveText("操作中", { timeout: 10000 });
    await b.screenshot({ path: "test-results/network-observer.png" });
    expect(errors).toEqual([]);
  } finally { await first.close(); await second.close(); }
});
