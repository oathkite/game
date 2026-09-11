import { expect, test, type Browser, type Page } from "@playwright/test";
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
    await page.goto("/");
    await page.getByRole("button", { name: "はじめる", exact: true }).click();
    await page.getByRole("button", { name: "オンライン対戦", exact: true }).click();
    await page.getByLabel("対戦で使う名前").fill(`Formation${index + 1}`);
  }));
  return { contexts, pages };
}

async function startRoom(pages: Page[], teams: string[]): Promise<string> {
  const owner = pages[0]!;
  await owner.getByRole("button", { name: "部屋を作る", exact: true }).click();
  const code = (await owner.getByTestId("room-code").textContent())!;
  for (const page of pages.slice(1)) {
    await page.getByLabel("部屋コード", { exact: true }).fill(code);
    await page.getByRole("button", { name: "部屋に参加", exact: true }).click();
    await expect(page.getByTestId("room-code")).toHaveText(code);
  }
  for (const [index, team] of teams.entries()) {
    await owner.getByLabel(`参加者${index + 1}のチーム`).selectOption(team);
    await expect(pages.at(-1)!.getByLabel(`参加者${index + 1}のチーム`)).toHaveValue(team);
  }
  for (const page of pages) await page.getByRole("button", { name: "準備完了", exact: true }).click();
  await owner.getByRole("button", { name: "対戦開始", exact: true }).click();
  await Promise.all(pages.map(page => expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true")));
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
    const active = await Promise.all(pages.map(page => page.locator(".battle-weapons button").first().isEnabled()));
    expect(active.filter(Boolean)).toHaveLength(1);
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
    const results = await Promise.all(pages.map(page => page.getByRole("table", { name: "試合成績" }).innerText()));
    expect(new Set(results).size).toBe(1);
    await expect(owner.locator('.battle-result-player[data-reaction="win"]')).toHaveCount(formation.at(-1)!);
    await expect(owner.locator('.battle-result-player[data-reaction="lose"]')).toHaveCount(teams.length - formation.at(-1)!);
    for (const page of pages) await page.getByRole("button", { name: "部屋へ戻る", exact: true }).click();
    await Promise.all(pages.map(page => expect(page.getByTestId("room-code")).toHaveText(code)));
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
