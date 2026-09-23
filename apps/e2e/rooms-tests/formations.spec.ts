import { expect, test, type Browser, type Page } from "@playwright/test";
import { assignTeam, createRoom, enterRooms, joinByCode, readyUp, teamLabel, teamOf, waitForBattle } from "./roomFlow";
import type { LabFrame } from "@game/protocol/v2-lab";

const formations = [[1, 7], [1, 1, 1, 1, 1, 1, 1, 1], [2, 2, 2], [1, 1, 1, 2]];

async function participants(browser: Browser, count: number, frames: (LabFrame | undefined)[], errors: string[]) {
  const contexts = await Promise.all(Array.from({ length: count }, () => browser.newContext({ locale: "ja-JP", viewport: { width: 1440, height: 900 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  await Promise.all(pages.map(async (page, index) => {
    page.on("pageerror", error => errors.push(error.message));
    page.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "lab.frame") frames[index] = message;
    }));
    await enterRooms(page, `Formation${index + 1}`);
  }));
  return { contexts, pages };
}

async function startRoom(pages: Page[], teams: string[]): Promise<string> {
  const owner = pages[0]!;
  const code = await createRoom(owner);
  for (const page of pages.slice(1)) await joinByCode(page, code);
  for (const [index, team] of teams.entries()) {
    if (index > 0) await assignTeam(owner, index, team);
    await expect(teamOf(pages.at(-1)!, index)).toHaveAccessibleName(teamLabel(team));
  }
  for (const page of pages.slice(1)) await readyUp(page);
  await owner.getByRole("button", { name: "対戦開始", exact: true }).click();
  await Promise.all(pages.map(page => expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true", { timeout: 20000 })));
  await Promise.all(pages.map(waitForBattle));
  return code;
}

for (const formation of formations) test(`formation ${formation.join(":")} shares a shot, result and return`, async ({ browser }) => {
  test.setTimeout(180000);
  const teams = formation.flatMap((count, index) => Array<string>(count).fill(`t${index}`));
  const frames: (LabFrame | undefined)[] = [], errors: string[] = [];
  const { contexts, pages } = await participants(browser, teams.length, frames, errors);
  try {
    const code = await startRoom(pages, teams);
    expect(frames).toHaveLength(teams.length);
    for (const frame of frames) for (const [index, teamId] of teams.entries()) {
      expect(frame!.players.find(player => player.nickname === `Formation${index + 1}`)?.teamId).toBe(teamId);
    }
    const owner = pages[0]!;
    await expect.poll(async () => Number(await owner.locator(".countdown-dial > span").innerText()), { timeout: 25000 }).toBeGreaterThanOrEqual(18);
    // 手番の操作はカメラの移動と並行して少し遅れて始まる（turn-delay.md）。
    const enabled = () => Promise.all(pages.map(page => page.locator(".battle-weapons button").first().isEnabled()));
    await expect.poll(async () => (await enabled()).filter(Boolean).length, { timeout: 15000 }).toBe(1);
    const active = await enabled();
    const shooter = pages[active.indexOf(true)]!;
    await shooter.keyboard.down("Space"); await shooter.waitForTimeout(300); await shooter.keyboard.up("Space");
    await Promise.all(pages.map(page => expect(page.getByTestId("phase")).toHaveText("射撃を再生中")));
    await Promise.all(pages.map(page => expect(page.getByTestId("phase")).toHaveText("操作中", { timeout: 15000 })));
    const winningTeam = teams.at(-1)!;
    for (const [index, page] of pages.entries()) if (teams[index] !== winningTeam) {
      await page.getByRole("button", { name: "設定を開く", exact: true }).click();
      await page.getByRole("button", { name: "降参", exact: true }).click();
    }
    await Promise.all(pages.map(page => expect(page.getByRole("table", { name: "試合成績" })).toBeVisible()));
    for (const frame of frames) expect(frame!.result).toEqual({ type: "win", teamId: winningTeam });
    // 成績の数字はカウントアップするので、段階表示が終わってから読む。
    await Promise.all(pages.map(page => expect(page.locator(".result-table-scroll")).toHaveAttribute("data-motion", "done", { timeout: 15000 })));
    const results = await Promise.all(pages.map(page => page.getByRole("table", { name: "試合成績" }).innerText()));
    expect(new Set(results).size).toBe(1);
    const table = owner.getByRole("table", { name: "試合成績" });
    await expect(table.locator('tbody tr[data-reaction="win"]')).toHaveCount(formation.at(-1)!);
    await expect(table.locator('tbody tr[data-reaction="lose"]')).toHaveCount(teams.length - formation.at(-1)!);
    // 全員がそろった瞬間に部屋へ戻り、対戦画面の破棄（PixiJS の WebGL loseContext）がヘッドレス Chromium で数秒から数十秒止まる。
    // 最後のクリックの後に待たず、戻った画面の確認に余裕を持たせる。この停止は不具合として別に追っている。
    for (const page of pages) await page.getByRole("button", { name: "部屋に戻る", exact: true }).click({ noWaitAfter: true });
    await Promise.all(pages.map(page => expect(page.getByTestId("room-code")).toHaveText(code, { timeout: 90000 })));
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
