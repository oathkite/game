import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { LabFrame } from "@game/protocol/v2-lab";
import { chooseNaturalShot } from "./natural-shot";

test("eight browsers reach a result using real shots without surrender or state injection", async ({ browser }, info) => {
  test.setTimeout(1_200_000);
  const contexts = await Promise.all(Array.from({ length: 8 }, () => browser.newContext({ locale: "ja-JP", viewport: { width: 1280, height: 720 } })));
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const frames: (LabFrame | undefined)[] = new Array(8), errors: string[] = [], transcript: unknown[] = [];
  try {
    for (const [i, page] of pages.entries()) {
      page.on("pageerror", error => errors.push(error.message));
      page.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
        const message = JSON.parse(String(payload));
        if (message.type === "lab.frame") frames[i] = message;
      }));
      await page.addInitScript(() => {
        const Native = WebSocket;
        window.WebSocket = class extends Native {
          constructor(url: string | URL, protocols?: string | string[]) {
            super(url, protocols);
            (window as Window & { matchTestSocket?: WebSocket }).matchTestSocket = this;
          }
        };
      });
      await page.goto("/");
      await page.getByRole("button", { name: "はじめる", exact: true }).click();
      await page.getByRole("button", { name: "オンライン対戦", exact: true }).click();
      await page.getByLabel("対戦で使う名前").fill(`Natural${i + 1}`);
    }
    const owner = pages[0]!;
    await owner.getByRole("button", { name: "部屋を作る", exact: true }).click();
    const code = (await owner.getByTestId("room-code").textContent())!;
    for (const page of pages.slice(1)) {
      await page.getByLabel("部屋コード", { exact: true }).fill(code);
      await page.getByRole("button", { name: "部屋に参加", exact: true }).click();
      await expect(page.getByTestId("room-code")).toHaveText(code);
    }
    for (let i = 0; i < 8; i++) {
      await owner.getByLabel(`参加者${i + 1}のチーム`).selectOption(i < 4 ? "t0" : "t1");
      await expect(pages[7]!.getByLabel(`参加者${i + 1}のチーム`)).toHaveValue(i < 4 ? "t0" : "t1");
    }
    for (const page of pages) await page.getByRole("button", { name: "準備完了", exact: true }).click();
    await owner.getByRole("button", { name: "対戦開始", exact: true }).click();
    for (const page of pages) await expect(page.getByTestId("network-world")).toHaveAttribute("data-loaded", "true");
    const ids = await Promise.all(pages.map(page => page.getByTestId("identity").textContent()));
    let shots = 0;
    while (frames[0]!.phase !== "finished" && shots < 96) {
      const before = frames[0]!;
      await expect.poll(() => frames.every(frame => frame?.phase === "acting" && frame.turnId === before.turnId)).toBe(true);
      const aim = chooseNaturalShot(before), actor = ids.indexOf(before.actorId);
      expect(actor).toBeGreaterThanOrEqual(0);
      const command = { version: 2, type: "turn.fire", matchId: before.matchId, turnId: before.turnId,
        commandId: `natural-${shots}`, ackMoveSeq: before.movement.ackMoveSeq,
        slot: aim.slot, facing: aim.facing, elevation: aim.elevation, power: aim.power };
      await pages[actor]!.evaluate(command => (window as Window & { matchTestSocket?: WebSocket }).matchTestSocket!.send(JSON.stringify(command)), command);
      await expect.poll(() => frames[actor]?.phase).toBe("replaying");
      await expect.poll(() => frames.every(frame => frame?.phase === "finished" || (frame?.phase === "acting" && frame.turnId > before.turnId)), { timeout: 15000 }).toBe(true);
      const canonical = (frame: LabFrame) => JSON.stringify({ turnId: frame.turnId, phase: frame.phase, result: frame.result, players: frame.players, terrainOps: frame.terrainOps, wind: frame.wind });
      expect(new Set(frames.map(frame => canonical(frame!))).size).toBe(1);
      shots++;
      transcript.push({ shot: shots, command, hp: frames[0]!.players.map(player => player.hp), terrainOps: frames[0]!.terrainOps.length });
      console.info(`Natural match shot ${shots}: ${frames[0]!.players.filter(player => !player.eliminated).length} alive, ${frames[0]!.phase}`);
    }
    const result = frames[0]!;
    expect(result.phase).toBe("finished"); expect(shots).toBeGreaterThan(1);
    expect(result.terrainOps.length).toBeGreaterThan(0);
    expect(Object.values(result.stats!).reduce((sum, stats) => sum + stats.shots, 0)).toBe(shots);
    for (const page of pages) await expect(page.getByRole("table", { name: "試合成績" })).toBeVisible();
    await owner.screenshot({ path: `test-results/natural-match-${info.project.name}.png` });
    const report = JSON.stringify({ build: result.build, map: result.map.id, result: result.result, shots, transcript }, null, 2);
    await writeFile(`test-results/natural-match-${info.project.name}.json`, report);
    await info.attach("natural-match.json", { body: report, contentType: "application/json" });
    for (const page of pages) await page.getByRole("button", { name: "部屋へ戻る", exact: true }).click();
    for (const page of pages) await expect(page.getByTestId("room-code")).toHaveText(code);
    expect(errors).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});
