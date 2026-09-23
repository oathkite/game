import { expect, type Page } from "@playwright/test";

// 左上の手番順リスト（turn-delay.md）。生存者の名前を並べ、先頭が現在の手番。
export const turnOrder = (page: Page) => page.getByRole("list", { name: "各プレイヤーの次の出番" }).locator(".turn-order-name");

export async function assertRosterReadable(page: Page): Promise<void> {
  const rows = await turnOrder(page).evaluateAll(nodes => nodes.map(node => {
    const row = node.getBoundingClientRect();
    const name = node.querySelector(".turn-order-player")!.getBoundingClientRect();
    return { inViewport: row.left >= 0 && row.right <= innerWidth && row.top >= 0 && row.bottom <= innerHeight, readableNameWidth: name.width };
  }));
  expect(rows).toHaveLength(8);
  for (const row of rows) {
    expect(row.inViewport).toBe(true);
    expect(row.readableNameWidth).toBeGreaterThanOrEqual(30);
  }
}
