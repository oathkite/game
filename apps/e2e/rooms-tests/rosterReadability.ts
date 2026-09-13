import { expect, type Page } from "@playwright/test";

export async function assertRosterReadable(page: Page): Promise<void> {
  const seats = await page.locator(".battle-seat").evaluateAll(nodes => nodes.map(node => {
    const seat = node.getBoundingClientRect();
    const hp = node.querySelector(".battle-hp")!.getBoundingClientRect();
    const badge = node.querySelector(".battle-upcoming")?.getBoundingClientRect();
    const name = node.querySelector("strong")!.getBoundingClientRect();
    return {
      inViewport: seat.left >= 0 && seat.right <= innerWidth,
      readableNameWidth: name.width,
      hpWidth: hp.width,
      badgeOverlapsHp: Boolean(badge && badge.left < hp.right && badge.right > hp.left && badge.top < hp.bottom && badge.bottom > hp.top),
    };
  }));
  expect(seats).toHaveLength(8);
  for (const seat of seats) {
    expect(seat.inViewport).toBe(true);
    expect(seat.readableNameWidth).toBeGreaterThanOrEqual(30);
    expect(seat.hpWidth).toBeGreaterThan(20);
    expect(seat.badgeOverlapsHp).toBe(false);
  }
}
