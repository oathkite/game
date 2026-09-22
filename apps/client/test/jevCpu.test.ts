import { afterEach, expect, it, vi } from "vitest";
import { createEngine, DEFAULT_ENGINE_TIMING } from "@game/engine";
import { cpuSituation, requestCpuDecision } from "../src/practice/jevCpu";
const initial = () => createEngine({ ...DEFAULT_ENGINE_TIMING, rng: () => 0.5 }, { roomCode: "CPU000", mapName: "ridgeline", players: [
  { nickname: "Private player name", colors: { primary: "red", secondary: "yellow" }, loadout: ["cannon", "triple"] },
  { nickname: "CPU", colors: { primary: "cyan", secondary: "blue" }, loadout: ["cannon", "triple"] },
] });
afterEach(() => vi.useRealTimers());
it("盤面要約に名前を含めず、サイズを制限する", () => {
  const input = cpuSituation(initial(), "normal");
  expect(JSON.stringify(input)).not.toContain("Private");
  expect(JSON.stringify(input).length).toBeLessThan(512);
  expect(input.terrain).toHaveLength(9);
});
it("Jev用サーバーの選択を検証し、不正応答はローカルCPUへ戻す", async () => {
  const decision = { movement: "hold", weapon: "cannon", trajectory: "lob", pace: "careful" };
  expect(await requestCpuDecision(initial(), "normal", new AbortController().signal, "https://cpu.test", async () => Response.json(decision))).toEqual(decision);
  expect(await requestCpuDecision(initial(), "normal", new AbortController().signal, "https://cpu.test", async () => Response.json({ movement: "teleport" }))).toBeNull();
});
it("未設定なら通信せず、終了時には通信を中止する", async () => {
  const fetcher = vi.fn();
  expect(await requestCpuDecision(initial(), "normal", new AbortController().signal, "", fetcher)).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  const controller = new AbortController();
  const pending = requestCpuDecision(initial(), "normal", controller.signal, "https://cpu.test", async (_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("abort")))));
  controller.abort();
  expect(await pending).toBeNull();
});
it("応答が遅い場合は3秒でローカルCPUへ戻す", async () => {
  vi.useFakeTimers();
  const pending = requestCpuDecision(initial(), "normal", new AbortController().signal, "https://cpu.test", async (_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(new Error("timeout")))));
  await vi.advanceTimersByTimeAsync(3000);
  expect(await pending).toBeNull();
});
