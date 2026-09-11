import { expect, test } from "@playwright/test";

test("Suno audio follows scenes and live output settings", async ({ page }) => {
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
  const activeMusic = () => page.evaluate(() => {
    const probe = (window as unknown as { audioProbe: { sources: AudioBufferSourceNode[]; ended: Set<AudioBufferSourceNode> } }).audioProbe;
    return probe.sources.filter(source => source.loop && !probe.ended.has(source)).map(source => source.buffer!.duration);
  });
  const outputVolume = () => page.evaluate(() => (window as unknown as { audioProbe: { gains: GainNode[] } }).audioProbe.gains[0]?.gain.value);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?prototype=world");
  await expect(page.getByRole("button", { name: "はじめる", exact: true })).toBeVisible();
  expect(await activeMusic()).toEqual([]);
  await page.getByRole("heading", { name: "KEROPOD（ケロポッド）", exact: true }).click();
  await expect.poll(async () => (await activeMusic()).length).toBe(1);
  const title = (await activeMusic())[0];
  await page.getByRole("button", { name: "はじめる", exact: true }).click();
  await expect.poll(async () => { const playing = await activeMusic(); return playing.length === 1 && playing[0] !== title; }).toBe(true);
  const lobby = (await activeMusic())[0];
  await page.getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByRole("heading", { name: "整備と設定" })).toBeVisible();
  expect(await activeMusic()).toEqual([lobby]);
  await page.getByRole("slider", { name: "音量", exact: true }).fill("20");
  await expect.poll(outputVolume).toBeCloseTo(0.2);
  await page.getByRole("button", { name: "音を消す", exact: true }).click();
  await expect.poll(outputVolume).toBe(0);
  await page.getByRole("button", { name: "音を出す", exact: true }).click();
  await expect.poll(outputVolume).toBeCloseTo(0.2);
  await page.getByRole("button", { name: "ロビーに戻る", exact: true }).click();
  await page.getByRole("button", { name: "プラクティスへ", exact: true }).click();
  await expect.poll(async () => { const playing = await activeMusic(); return playing.length === 1 && playing[0] !== lobby; }).toBe(true);
  await page.getByRole("button", { name: "設定を開く", exact: true }).click();
  await page.getByRole("button", { name: "降参して対戦を終える", exact: true }).click();
  await expect(page.getByRole("heading", { name: /の勝利/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const probe = (window as unknown as { audioProbe: { sources: AudioBufferSourceNode[] } }).audioProbe;
    return probe.sources.some(source => !source.loop && Math.abs((source.buffer?.duration ?? 0) - 4.8) < 0.02);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const probe = (window as unknown as { audioProbe: { sources: AudioBufferSourceNode[] } }).audioProbe;
    return probe.sources.filter(source => source.loop).length;
  })).toBe(4);
  const loopEdges = await page.evaluate(() => {
    const probe = (window as unknown as { audioProbe: { sources: AudioBufferSourceNode[] } }).audioProbe;
    return probe.sources.filter(source => source.loop).flatMap(source => {
      const buffer = source.buffer!;
      return Array.from({ length: buffer.numberOfChannels }, (_, channel) => {
        const data = buffer.getChannelData(channel);
        return { first: Math.abs(data[0]!), last: Math.abs(data[data.length - 1]!),
          hasSignal: data.subarray(1000, 10000).some(sample => Math.abs(sample) > 0.001) };
      });
    });
  });
  expect(loopEdges).toHaveLength(8);
  for (const edge of loopEdges) expect(edge).toEqual({ first: 0, last: 0, hasSignal: true });
  expect(errors).toEqual([]);
});
