import type { TerrainOp } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { Container, Graphics, Texture, TilingSprite } from "pixi.js";
import { PALETTE } from "../palette";
import { ART_PER_CELL, type PixelGrid, type Rect } from "../pixelGrid";
import type { FxLayer } from "./fxLayer";
import { BAYER4, craterGlow, impactSmoke, impactSparks, lightBurst, muzzleSmoke, trackDust, wreckDebris } from "./impactFx";
import type { Ramp } from "../palette";
import { terrainDebris } from "./terrainDebris";

// 再生の外で寿命が尽きるまで描く演出の入口。設計書 41。
// 練習（replay.ts）とオンライン（NetworkField.tsx）が同じ呼び方で使う。age は生まれてからの ms で、再接続などで途中から描くときに使う。

export type RendererEffects = {
  /** 地形が削れた瞬間。削れた地形の破片（D1）と赤熱する縁（I3） */
  readonly crater: (before: TerrainMask, after: TerrainMask, op: TerrainOp, seed: number, age?: number) => void;
  /** 着弾。火花（I1）、煙（I2）、光（I4）。ダメージ段階 3 では暗転（I5）も出す。位置はセル */
  readonly impact: (cx: number, cy: number, radius: number, tier: number, seed: number, age?: number) => void;
  /** 撃破の瞬間（delay ms 後）に 1 コマだけ画面全体を白くする。1 秒に 1 回まで（I5） */
  readonly killFlash: (delay?: number) => void;
  /** 発射の煙の輪。位置はセル、angle は弾が飛び出す向き（設計書 41 の段階 4） */
  readonly muzzle: (x: number, y: number, angle: number, seed: number, age?: number) => void;
  /** 走行の土煙。位置はセルで接地点 */
  readonly dust: (x: number, y: number, facing: 1 | -1, seed: number) => void;
  /** 撃破の破片。delay ms 後に機体の色で散らす */
  readonly wreck: (x: number, y: number, ramp: Ramp, seed: number, delay?: number) => void;
  /** 粒の時計を止める（ヒットストップ） */
  readonly freeze: (ms: number) => void;
  /** 今描いている粒の数。FX ラボと測定に使う */
  readonly particleCount: () => number;
  /** 粒をすべて消す。FX ラボで撃ち直すときに使う */
  readonly clear: () => void;
};

/** 暗転の長さ、全画面の光の長さと間隔（ms） */
export const DIM_MS = 300;
export const FLASH_MS = 34;
export const FLASH_GAP_MS = 1000;
/** 光の半径は爆風半径のこの倍で、上限のセル数を超えない。大きな爆風で光の模様が画面を覆わないようにする */
const LIGHT_SCALE = 1.3;
const LIGHT_MAX_CELLS = 14;
const LIGHT_MS = 300;

/** 暗い層の 4 × 4 の模様。Bayer の閾値の小さい 4 つのドットだけを夜空のいちばん暗い色で塗る */
const dimTexture = (): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = 4; canvas.height = 4;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context がない");
  ctx.fillStyle = `#${PALETTE.sky0.toString(16).padStart(6, "0")}`;
  BAYER4.forEach((v, i) => { if (v < 4) ctx.fillRect(i % 4, Math.floor(i / 4), 1, 1); });
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
};

/** 暗い層。地形の全体を覆い、1 texel を 1 art px にする。模様は world に固定されるのでカメラが動いても這わない */
export const createDimLayer = (width: number, height: number): TilingSprite => {
  const sprite = new TilingSprite({ texture: dimTexture(), width, height });
  sprite.tileScale.set(1 / ART_PER_CELL);
  sprite.visible = false;
  return sprite;
};

/** 画面全体の白。stage に置き、1 コマだけ見せる */
export const createFlashLayer = (): Graphics => {
  const g = new Graphics();
  g.visible = false;
  return g;
};

type Deps = {
  readonly fx: FxLayer;
  readonly texels: ((mask: TerrainMask, rect: Rect) => PixelGrid) | undefined;
  readonly dim: Container;
  readonly flash: Graphics;
  readonly screen: () => { readonly width: number; readonly height: number };
  readonly reduced: () => boolean;
  /** 走行の土煙の色。ステージの土の色（明るい順） */
  readonly soil: readonly number[];
};

export const createRendererEffects = (d: Deps): RendererEffects & { readonly tick: () => void } => {
  let dimFrom = Infinity, dimUntil = -Infinity, flashFrom = Infinity, flashUntil = -Infinity, lastFlash = -Infinity;
  return {
    crater: (before, after, op, seed, age = 0) => {
      const texels = d.texels;
      if (texels) d.fx.emit("back", terrainDebris({ before, after, op, seed, texels: (rect) => texels(before, rect) }), age);
      d.fx.emit("back", craterGlow(before, after, op, seed), age);
    },
    impact: (cx, cy, radius, tier, seed, age = 0) => {
      d.fx.emit("front", impactSparks(cx, cy, radius, seed), age);
      d.fx.emit("back", impactSmoke(cx, cy, radius, seed), age);
      d.fx.emit("back", lightBurst({ cx, cy, radius: Math.min(radius * LIGHT_SCALE, LIGHT_MAX_CELLS) * ART_PER_CELL, duration: LIGHT_MS, strength: 1, inner: PALETTE.fire1, outer: PALETTE.fire3 }), age);
      // 火花や光と同じく、生まれる時刻（爆風が広がり始める瞬間）から暗くする
      if (tier >= 3 && !d.reduced()) { dimFrom = d.fx.now() - age; dimUntil = dimFrom + DIM_MS; }
    },
    killFlash: (delay = 0) => {
      const at = d.fx.now() + Math.max(0, delay);
      if (d.reduced() || at - lastFlash < FLASH_GAP_MS) return;
      lastFlash = at; flashFrom = at; flashUntil = at + FLASH_MS;
    },
    muzzle: (x, y, angle, seed, age = 0) => { if (!d.reduced()) d.fx.emit("front", muzzleSmoke(x, y, angle, seed), age); },
    dust: (x, y, facing, seed) => { if (!d.reduced()) d.fx.emit("back", trackDust(x, y, facing, d.soil.slice(0, 2), seed)); },
    wreck: (x, y, ramp, seed, delay = 0) => {
      if (!d.reduced()) d.fx.emit("front", wreckDebris(x, y, [ramp.light, ramp.base, ramp.shadow, PALETTE.metal1, PALETTE.metal2], seed), -delay);
    },
    freeze: (ms) => { if (!d.reduced()) d.fx.freeze(ms); },
    particleCount: d.fx.count,
    clear: () => { d.fx.clear(); dimFrom = Infinity; dimUntil = -Infinity; flashFrom = Infinity; flashUntil = -Infinity; lastFlash = -Infinity; },
    tick: () => {
      const now = d.fx.now();
      d.dim.visible = now >= dimFrom && now < dimUntil;
      const flashing = now >= flashFrom && now < flashUntil;
      if (flashing && !d.flash.visible) {
        const s = d.screen();
        d.flash.clear().rect(0, 0, s.width, s.height).fill(PALETTE.white);
      }
      d.flash.visible = flashing;
    },
  };
};
