import { Container, type Ticker } from "pixi.js";
import { afterEach, expect, it, vi } from "vitest";
import { spawnDamageLabel } from "@/game/damageLabel";

// ダメージ数字の弾み（設計書 41.13）。5 × 7 のドット文字の高さは 7 × 1 画素の大きさ + 上下の輪郭 2 px

afterEach(() => vi.unstubAllGlobals());

const spawnBig = () => {
  const parent = new Container();
  const ticker = { add: vi.fn(), remove: vi.fn(), deltaMS: 16 } as unknown as Ticker;
  spawnDamageLabel({ parent, ticker, text: "-35", color: "red", big: true, x: 100, y: 100, onEnd: () => {} });
  return parent.children[0]!;
};

it("直撃の数字は、出た直後に 1 段大きい 4 px の画素で描く", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  expect(spawnBig().height).toBe(7 * 4 + 2);
});

it("動きを減らす設定では、出た直後の 1 コマも弾ませずに 3 px の画素で描く", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
  expect(spawnBig().height).toBe(7 * 3 + 2);
});
