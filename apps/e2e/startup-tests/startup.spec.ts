import { expect, test } from "@playwright/test";

test("cold title is operable within 3 seconds at p95 on 10 Mbps / 150 ms", async ({ browser }, testInfo) => {
  const samples: number[] = [];
  for (let sample = 0; sample < 20; sample += 1) {
    const context = await browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } });
    try {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false, latency: 150, downloadThroughput: 10_000_000 / 8,
        uploadThroughput: 10_000_000 / 8, connectionType: "cellular4g",
      });
      await page.addInitScript(() => {
        const state = window as Window & { startReadyMs?: number };
        const measure = () => {
          const button = Array.from(document.querySelectorAll("button")).find(button => button.textContent === "はじめる");
          if (button && !button.disabled) {
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            if (rect.width > 0 && rect.height > 0 && style.visibility === "visible" && Number(style.opacity) > 0 && hit && button.contains(hit)) {
              state.startReadyMs = performance.now();
              return;
            }
          }
          requestAnimationFrame(measure);
        };
        requestAnimationFrame(measure);
      });
      await page.goto("http://127.0.0.1:5188/", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => (window as Window & { startReadyMs?: number }).startReadyMs !== undefined);
      samples.push(await page.evaluate(() => (window as Window & { startReadyMs?: number }).startReadyMs!));
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await expect(page.getByRole("button", { name: "オンライン対戦", exact: true })).toBeVisible();
    } finally { await context.close(); }
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const p95 = sorted[Math.ceil(sorted.length * .95) - 1]!;
  console.info(`Cold start p95=${p95.toFixed(1)}ms; samples=${JSON.stringify(samples)}`);
  await testInfo.attach("cold-start.json", { body: JSON.stringify({ samples, p95, downloadMbps: 10, latencyMs: 150 }), contentType: "application/json" });
  expect(p95).toBeLessThanOrEqual(3000);
});
