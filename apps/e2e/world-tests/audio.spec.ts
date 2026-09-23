import { expect, test } from "@playwright/test";
import { startFreePractice } from "./practiceFlow";

test("scene music follows the garage, the stage and the result with live output settings", async ({ page }) => {
  await page.addInitScript(() => {
    const probe = { gains: [] as GainNode[], sources: [] as AudioBufferSourceNode[], ended: new Set<AudioBufferSourceNode>() };
    Object.assign(window, { audioProbe: probe });
    const gain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      const node = gain.call(this); probe.gains.push(node); return node;
    };
    const source = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const node = source.call(this); probe.sources.push(node);
      node.addEventListener("ended", () => probe.ended.add(node)); return node;
    };
  });
  type Probe = { gains: GainNode[]; sources: AudioBufferSourceNode[]; ended: Set<AudioBufferSourceNode> };
  // 効果音のノイズも loop で鳴らすので、BGM は 5 秒を超える音源だけを数える
  const activeMusic = () => page.evaluate(() => {
    const probe = (window as unknown as { audioProbe: Probe }).audioProbe;
    return probe.sources.filter(source => source.loop && (source.buffer?.duration ?? 0) > 5 && !probe.ended.has(source)).map(source => source.buffer!.duration);
  });
  // gains[0] は効果音、gains[1] は BGM の出力（app/audio.ts の作成順）。
  const outputVolumes = () => page.evaluate(() => (window as unknown as { audioProbe: Probe }).audioProbe.gains.slice(0, 2).map(node => node.gain.value));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "はじめる", exact: true })).toBeVisible();
  expect(await activeMusic()).toEqual([]);
  await page.getByRole("heading", { name: "TANK SHOOT", exact: true }).click();
  await expect.poll(async () => (await activeMusic()).length).toBe(1);
  // タイトルからプラクティスのメニューまでは同じ格納庫の曲を流し続ける。
  const hangar = (await activeMusic())[0];
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByRole("heading", { name: "整備と設定" })).toBeVisible();
  expect(await activeMusic()).toEqual([hangar]);
  await page.getByRole("slider", { name: "効果音量", exact: true }).fill("20");
  await page.getByRole("slider", { name: "BGM音量", exact: true }).fill("30");
  await expect.poll(async () => (await outputVolumes()).map(value => Math.round(value * 100))).toEqual([20, 30]);
  await page.getByRole("button", { name: "音を消す", exact: true }).click();
  await expect.poll(outputVolumes).toEqual([0, 0]);
  await page.getByRole("button", { name: "音を出す", exact: true }).click();
  await expect.poll(async () => (await outputVolumes()).map(value => Math.round(value * 100))).toEqual([20, 30]);
  await page.getByRole("dialog", { name: "整備と設定" }).getByRole("button", { name: "閉じる", exact: true }).click();
  await startFreePractice(page);
  await expect.poll(async () => { const playing = await activeMusic(); return playing.length === 1 && playing[0] !== hangar; }).toBe(true);
  const stage = (await activeMusic())[0];
  await page.getByRole("button", { name: "設定を開く", exact: true }).click();
  await page.getByRole("button", { name: "降参して対戦を終える", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^(勝利|敗北)$/ })).toBeVisible();
  await expect.poll(async () => { const playing = await activeMusic(); return playing.length === 1 && playing[0] !== stage; }).toBe(true);
  const seams = await page.evaluate(() => {
    const probe = (window as unknown as { audioProbe: Probe }).audioProbe;
    return probe.sources.filter(source => source.loop && (source.buffer?.duration ?? 0) > 5).flatMap(source => {
      const buffer = source.buffer!;
      return Array.from({ length: buffer.numberOfChannels }, (_, channel) => {
        const data = buffer.getChannelData(channel);
        const steps = new Float32Array(data.length - 1);
        for (let i = 1; i < data.length; i++) steps[i - 1] = Math.abs(data[i]! - data[i - 1]!);
        steps.sort();
        // ループの継ぎ目の段差が、曲の中で普通に起きる段差の範囲に収まっていればクリックにならない（39.4）
        const seam = Math.abs(data[0]! - data[data.length - 1]!);
        return { smooth: seam <= steps[Math.floor(steps.length * 0.999)]!, hasSignal: data.subarray(1000, 10000).some(sample => Math.abs(sample) > 0.001) };
      });
    });
  });
  // 格納庫、対戦、リザルトの 3 曲を左右それぞれ
  expect(seams).toHaveLength(6);
  for (const seam of seams) expect(seam).toEqual({ smooth: true, hasSignal: true });
  expect(errors).toEqual([]);
});
