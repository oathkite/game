import { expect, it, vi } from "vitest";
import type { TrajectoryInput } from "@game/protocol";
import { DOUBLE_GAP_TICKS, flatMask, simulateShot, shot } from "@game/sim";
import { playReplay } from "../src/game/replay";
import type { Renderer } from "../src/game/renderer";
import type { PlayerView, ReplayJob } from "../src/match/types";

// 2 人対戦の再生のアイテム（設計書 42）。ダブルシュートの 2 発目は 1 発目が終わってから撃ち、テレポートした機体は飛翔の間は撃った位置にいる

/** どの名前の呼び出しも受け付ける描画の代役。呼び出しは calls に残す */
const fakeRenderer = () => {
  const calls: { readonly name: string; readonly args: readonly unknown[]; readonly at: number }[] = [];
  let frame: ((deltaMs: number) => void) | null = null, now = 0;
  const stub = (prefix: string): unknown => new Proxy(() => undefined, {
    get: (_, key: string) => key === "then" ? undefined : stub(`${prefix}.${key}`),
    apply: (_, __, args: unknown[]) => { calls.push({ name: prefix, args, at: now }); return stub(`${prefix}()`); },
  });
  const renderer = new Proxy({}, { get: (_, key: string) => key === "onFrame" ? (fn: (deltaMs: number) => void) => { frame = fn; return () => { frame = null; }; } : stub(key) }) as Renderer;
  const run = (ms: number) => { for (let t = 0; t < ms && frame; t += 10) { now += 10; frame(10); } };
  return { renderer, calls, run };
};

const players = (x0: number, x1: number): readonly [PlayerView, PlayerView] => [0, 1].map(seat => ({ seat, nickname: `p${seat}`, colors: { primary: "red", secondary: "blue" }, loadout: ["cannon", "digger"],
  x: seat === 0 ? x0 : x1, y: 150, hp: 100, facing: seat === 0 ? 1 : -1, connected: true })) as unknown as readonly [PlayerView, PlayerView];

const jobOf = (input: TrajectoryInput, before: readonly [PlayerView, PlayerView]): ReplayJob => {
  const mask = flatMask(), out = simulateShot(mask, before, input);
  const after = before.map((p, i) => ({ ...p, x: out.result.xAfter[i]!, y: out.result.yAfter[i]!, hp: out.result.hpAfter[i]! })) as unknown as readonly [PlayerView, PlayerView];
  return { id: 1, shot: out.result, paths: out.paths, maskBefore: mask, maskAfter: out.mask, playersBefore: before, playersAfter: after, ...(out.firstShot ? { firstShot: out.firstShot } : {}) };
};

it("ダブルシュートの 2 発目は、1 発目の弾が終わってから間を置いて撃つ", () => {
  const job = jobOf(shot({ x: 60, elevation: 45, power: 50, item: "double" }), players(60, 150));
  expect(job.firstShot?.paths).toBe(1);
  const { renderer, calls, run } = fakeRenderer();
  const sound = vi.fn();
  playReplay(renderer, job, [45, 45], 0, { sound, done: vi.fn(), reduceMotion: false });
  run(8000);
  const launches = calls.filter(c => c.name === "effects.launch");
  expect(launches).toHaveLength(2);
  // 1 発目の飛翔（位置列の長さ × 1/60 秒）と間を置いてから 2 発目が出る
  const firstFlight = (job.paths[0]!.points.length - 1) * (1000 / 60);
  expect(launches[1]!.at - launches[0]!.at).toBeGreaterThanOrEqual(firstFlight + DOUBLE_GAP_TICKS * (1000 / 60) - 20);
  expect(sound.mock.calls.filter(([name]) => String(name).includes("Fire") || String(name).includes("fire")).length).toBeGreaterThanOrEqual(2);
});

it("ダブルシュートの 1 発目で穴に落ちた相手は、2 発目の前に落ちる", () => {
  const job = jobOf(shot({ x: 60, elevation: 45, power: 50, item: "double" }), players(60, 150));
  const mid = job.firstShot!.positions[1]!;
  expect(mid.y).toBeGreaterThan(150);
  const { renderer, calls, run } = fakeRenderer();
  playReplay(renderer, job, [45, 45], 0, { sound: vi.fn(), done: vi.fn(), reduceMotion: true });
  run(8000);
  const secondLaunch = calls.filter(c => c.name === "effects.launch")[1]!.at;
  const target = calls.filter(c => c.name === "setTank" && c.args[0] === 1 && c.at <= secondLaunch).map(c => (c.args[1] as { y: number }).y);
  expect(target.at(-1)).toBe(mid.y);
});

it("テレポートした機体は飛翔の間は撃った位置にいて、落下させずに着地点へ移る", () => {
  const job = jobOf(shot({ x: 60, elevation: 45, power: 60, item: "teleport" }), players(60, 300));
  const landing = job.shot.teleport!;
  expect(landing.x).not.toBe(60);
  const { renderer, calls, run } = fakeRenderer();
  const done = vi.fn();
  playReplay(renderer, job, [45, 45], 0, { sound: vi.fn(), done, reduceMotion: true });
  run(8000);
  const poses = calls.filter(c => c.name === "setTank" && c.args[0] === 0).map(c => c.args[1] as { x: number; y: number; falling?: boolean });
  const moved = poses.findIndex(p => p.x === landing.x);
  expect(moved).toBeGreaterThan(0);
  expect(poses.slice(0, moved).every(p => p.x === 60)).toBe(true);
  expect(poses.some(p => p.falling)).toBe(false);
  expect(poses.at(-1)).toMatchObject(landing);
  expect(done).toHaveBeenCalled();
});
