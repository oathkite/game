import { Graphics } from "pixi.js";
import { hash32, unit } from "./fx/hash";
import { PALETTE } from "./palette";
import type { SkyTheme } from "./skyPaint";

// 漂う光。設計書 41 の段階 6。稜線と段丘は緑の蛍、石橋は塵、浮島は発光色のかけら。
// 風の計器は風の粒だけにするので（8.5）、風では動かさず、自分の周期でゆっくり漂って明滅する。動きを減らす設定では止める。

export const DRIFT_COUNT = 24;

/** 芯の色と、上下左右 1 art px の暈（かさ）の色。暈があると 1 art px の点でも光って見える（設計書 41.13 の評価の 3 回目） */
const COLORS: Readonly<Record<SkyTheme, readonly (readonly [number, number])[]>> = {
  ridge: [[PALETTE.greenLight, PALETTE.greenDark], [PALETTE.greenPale, PALETTE.greenMid]],
  canyon: [[PALETTE.smoke0, PALETTE.smoke2], [PALETTE.smoke1, PALETTE.smoke3]],
  basin: [[PALETTE.greenLight, PALETTE.greenDark], [PALETTE.fire1, PALETTE.fire4]],
  islands: [[PALETTE.energy0, PALETTE.energy2], [PALETTE.energy1, PALETTE.sky4]],
};

/** 光 i の t ms の位置（画面の割合）と点いているか。周期 1200〜2400 ms で明滅し、sin の軌道で漂う */
export const driftLightAt = (i: number, t: number, reduced: boolean): { readonly x: number; readonly y: number; readonly on: boolean } => {
  const h = hash32(41, i), period = 1200 + 1200 * unit(hash32(h, 1)), phase = unit(hash32(h, 2));
  const time = reduced ? 0 : t;
  const x = unit(hash32(h, 3)) + 0.03 * Math.sin((time / (period * 3)) * Math.PI * 2 + phase * 6);
  const y = 0.45 + 0.4 * unit(hash32(h, 4)) + 0.02 * Math.sin((time / (period * 2)) * Math.PI * 2 + phase * 4);
  return { x, y, on: reduced || ((time / period + phase) % 1) < 0.6 };
};

export const createDriftLights = (theme: SkyTheme, px: number) => {
  const graphics = new Graphics(), colors = COLORS[theme];
  let width = 0, height = 0, camera = 0, clock = 0, reduced = false;
  const draw = (): void => {
    graphics.clear();
    for (let i = 0; i < DRIFT_COUNT; i++) {
      const p = driftLightAt(i, clock, reduced);
      if (!p.on) continue;
      // カメラの 60% で横に流し、画面の幅で折り返す
      const x = ((((p.x * width + camera * 0.6) % width) + width) % width);
      const gx = Math.floor(x / px) * px, gy = Math.floor((p.y * height) / px) * px, [core, halo] = colors[i % colors.length]!;
      graphics.rect(gx - px, gy, px, px).rect(gx + px, gy, px, px).rect(gx, gy - px, px, px).rect(gx, gy + px, px, px).fill(halo);
      graphics.rect(gx, gy, px, px).fill(core);
    }
  };
  return {
    graphics,
    resize: (w: number, h: number): void => { width = w; height = h; draw(); },
    setCamera: (x: number): void => { camera = x; },
    tick: (deltaMs: number, reducedMotion: boolean): void => { clock += deltaMs; reduced = reducedMotion; if (width > 0) draw(); },
  };
};
