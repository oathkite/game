import type { CellPoint, WeaponId } from "@game/protocol";
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { blastStage } from "./explosionSprite";
import type { ExplosionTextures } from "./explosionTextures";
import { PALETTE, type Ramp } from "./palette";
import { ART_PER_CELL, colorRuns, type PixelGrid } from "./pixelGrid";
import { projectilePixels, type ProjectileArt } from "./projectileSprite";
import type { TrailDot } from "./trail";
import { projectileArtScale } from "./weaponArt";

// 弾、爆風、破片、外れの印。設計書 40.8 と 40.9、03 の 3.9。単位はセルで、絵は art px（1/4 セル）の格子に揃える。
// 1 発の射撃に弾は複数（扇）、爆風も複数（弾道 × 段）ありうるので、弾は添字で、爆風と破片と印は鍵で持つ。

export type ProjectileView = {
  readonly container: Container;
  /** 弾道 index の弾。x が null なら隠す */
  readonly setBullet: (index: number, x: number | null, y: number, angle: number) => void;
  readonly clear: () => void;
  /** 爆風。半径 r セル。on なら熱い火球、消灯なら冷えた火球、ring なら撃った側の主色の輪。cx が null か r が 0 なら消す */
  readonly setBlast: (key: string, cx: number | null, cy: number, r: number, on: boolean, ring?: boolean, frameIndex?: number) => void;
  /** 破片。1 セルの塊を格子に揃えて置く */
  readonly setDebris: (key: string, cells: readonly CellPoint[]) => void;
  /** 外れの印。セルの中心に十字。cx が null か on が偽なら消す */
  readonly setMissMark: (key: string, cx: number | null, cy: number, on: boolean) => void;
  /** 弾道 index の軌跡。設計書 38 の E3。空なら消す */
  readonly setTrail: (index: number, dots: readonly TrailDot[]) => void;
  /** 直撃の白黒反転。設計書 38 の E5。null なら消す */
  readonly setInvert: (key: string, cells: { readonly white: readonly CellPoint[]; readonly black: readonly CellPoint[] } | null) => void;
  readonly destroy: () => void;
};

/** ドットの絵を描くのに要るもの。撃った側の主色の段、爆発の texture、弾の絵（省略すれば武器の絵。テレポートはロケット） */
export type PixelFx = { readonly ramp: Ramp; readonly explosions: ExplosionTextures; readonly art?: ProjectileArt };

const ART = 1 / ART_PER_CELL;
const snap = (cells: number): number => Math.round(cells * ART_PER_CELL) / ART_PER_CELL;

/** 鍵ごとに Graphics を持つ層。無い鍵は作る */
const keyedLayer = (parent: Container) => {
  const map = new Map<string, Graphics>();
  return {
    get: (key: string): Graphics => {
      const found = map.get(key);
      if (found) return found;
      const g = new Graphics();
      map.set(key, g);
      parent.addChild(g);
      return g;
    },
    clear: () => {
      for (const g of map.values()) g.clear();
    },
  };
};

const fillCells = (g: Graphics, cells: readonly CellPoint[], color: number, size = 1): void => {
  if (cells.length === 0) return;
  const inset = (1 - size) / 2;
  for (const c of cells) g.rect(c.x + inset, c.y + inset, size, size);
  g.fill(color);
};

/** 軌跡の色。新しい点は淡い緑、古い点は中の緑（設計書 40.8） */
const TRAIL_RECENT_COLOR = PALETTE.greenPale;
const TRAIL_OLD_COLOR = PALETTE.greenMid;

const drawGrid = (g: Graphics, grid: PixelGrid): void => {
  g.clear();
  for (const r of colorRuns(grid)) g.rect(r.x * ART, r.y * ART, r.w * ART, ART).fill(r.color);
};

/** 弾の列。弾道の数だけ Graphics を持ち、向きと火花のコマが変わったときだけ描き直す */
const pixelBullets = (parent: Container, weapon: ProjectileArt, ramp: Ramp) => {
  const list: { readonly g: Graphics; drawn: PixelGrid | null }[] = [];
  return (index: number, x: number | null, y: number, angle: number): void => {
    while (list.length <= index) {
      const g = new Graphics();
      g.visible = false;
      parent.addChild(g);
      list.push({ g, drawn: null });
    }
    const bullet = list[index]!;
    bullet.g.visible = x !== null;
    if (x === null) return;
    // 掘削弾の導火線の火花とロケットの炎は、進んだ距離で瞬かせる。x と y のどちらが半セル進んでもコマが変わるよう、
    // 2 と 3 のどちらとも互いに素な係数で足す（x + y では右上へ 45 度で飛ぶ間に止まる）
    const grid = projectilePixels(weapon, ramp, angle, Math.floor(x * 2) * 5 + Math.floor(y * 2) * 7);
    if (grid !== bullet.drawn) { drawGrid(bullet.g, grid); bullet.drawn = grid; }
    bullet.g.position.set(snap(x), snap(y));
  };
};

/** 画像の弾の列。画像素材の経路で、今の対戦からは使われない */
const spriteBullets = (parent: Container, texture: Texture, scale: number) => {
  const list: Sprite[] = [];
  return (index: number, x: number | null, y: number, angle: number): void => {
    while (list.length <= index) {
      const s = new Sprite(texture);
      s.anchor.set(0.5, 0.6);
      s.scale.set(scale);
      s.visible = false;
      parent.addChild(s);
      list.push(s);
    }
    const sprite = list[index]!;
    sprite.visible = x !== null;
    if (x === null) return;
    sprite.position.set(x, y);
    sprite.rotation = angle;
  };
};

/** 爆風の Sprite。段階ごとの texture を使い回し、位置と texture だけを替える */
const pixelBlasts = (parent: Container, weapon: WeaponId, fx: PixelFx) => {
  const sprites = new Map<string, Sprite>();
  return {
    set: (key: string, cx: number | null, cy: number, r: number, on: boolean, ring: boolean): void => {
      let sprite = sprites.get(key);
      if (cx === null || r <= 0) { if (sprite) sprite.visible = false; return; }
      if (!sprite) { sprite = new Sprite(); sprite.scale.set(ART); parent.addChild(sprite); sprites.set(key, sprite); }
      const frame = fx.explosions.get(weapon, r, blastStage(on, ring), fx.ramp);
      sprite.texture = frame.texture;
      sprite.position.set(cx + 0.5 + frame.left * ART, cy + 0.5 + frame.top * ART);
      sprite.visible = true;
    },
    hide: (): void => { for (const s of sprites.values()) s.visible = false; },
  };
};

/** 1 セルの破片。輪郭の中に、主色の光、基準、影の 2 × 2 */
const drawChunks = (g: Graphics, cells: readonly CellPoint[], ramp: Ramp): void => {
  for (const c of cells) {
    g.rect(c.x, c.y, 1, 1).fill(PALETTE.outline);
    g.rect(c.x + ART, c.y + ART, ART, ART).fill(ramp.light);
    g.rect(c.x + 2 * ART, c.y + ART, ART, ART).rect(c.x + ART, c.y + 2 * ART, ART, ART).fill(ramp.base);
    g.rect(c.x + 2 * ART, c.y + 2 * ART, ART, ART).fill(ramp.shadow);
  }
};

/** 外れの印。セルの中心に、輪郭つきの主色の十字 */
const drawMissMark = (g: Graphics, ramp: Ramp, cx: number, cy: number): void => {
  const x = cx + 0.5, y = cy + 0.5;
  g.rect(x - 8 * ART, y - 2 * ART, 16 * ART, 4 * ART).rect(x - 2 * ART, y - 8 * ART, 4 * ART, 16 * ART).fill(PALETTE.outline);
  g.rect(x - 7 * ART, y - ART, 14 * ART, 2 * ART).rect(x - ART, y - 7 * ART, 2 * ART, 14 * ART).fill(ramp.base);
  g.rect(x - ART, y - ART, 2 * ART, 2 * ART).fill(ramp.light);
};

export const createProjectileView = (fx: PixelFx, weapon: WeaponId, texture?: Texture, impactFrames?: readonly Texture[]): ProjectileView => {
  const container = new Container();
  const [blasts, debris, misses, bullets, trails, inverts] = Array.from({ length: 6 }, () => new Container());
  container.addChild(trails!, blasts!, inverts!, debris!, misses!, bullets!);
  const trailLayer = keyedLayer(trails!), invertLayer = keyedLayer(inverts!), debrisLayer = keyedLayer(debris!), missLayer = keyedLayer(misses!);
  const impactSprites = new Map<string, Sprite>();
  const blastSprites = pixelBlasts(blasts!, weapon, fx);
  const setBullet = texture ? spriteBullets(bullets!, texture, projectileArtScale(weapon)) : pixelBullets(bullets!, fx.art ?? weapon, fx.ramp);

  return {
    container,
    setBullet,
    clear: () => {
      blastSprites.hide();
      trailLayer.clear();
      invertLayer.clear();
      for (const sprite of impactSprites.values()) sprite.visible = false;
      debrisLayer.clear();
      missLayer.clear();
      bullets!.children.forEach((g) => {
        g.visible = false;
      });
    },
    setBlast: (key, cx, cy, r, on, ring = false, frameIndex = 2) => {
      if (impactFrames) {
        // 画像の着弾の経路。今の対戦からは使われない
        let sprite = impactSprites.get(key);
        if (!sprite && cx !== null && on) {
          sprite = new Sprite(impactFrames[0]!); sprite.scale.set(1 / 12);
          blasts!.addChild(sprite); impactSprites.set(key, sprite);
        }
        if (sprite) {
          sprite.visible = cx !== null && on;
          if (cx !== null) { sprite.texture = impactFrames[frameIndex]!; sprite.position.set(cx - 8, cy - 8); }
        }
        return;
      }
      blastSprites.set(key, cx, cy, r, on, ring);
    },
    setDebris: (key, cells) => {
      const g = debrisLayer.get(key);
      g.clear();
      drawChunks(g, cells, fx.ramp);
    },
    setMissMark: (key, cx, cy, on) => {
      const g = missLayer.get(key);
      g.clear();
      if (cx !== null && on) drawMissMark(g, fx.ramp, cx, cy);
    },
    setTrail: (index, dots) => {
      const g = trailLayer.get(String(index));
      g.clear();
      // 点は 2 × 2 art px。弾の位置（小数）を art px の格子に丸める
      const at = (d: TrailDot): CellPoint => ({ x: snap(d.x - 0.25) - 0.25, y: snap(d.y - 0.25) - 0.25 });
      fillCells(g, dots.filter(d => !d.recent).map(at), TRAIL_OLD_COLOR, 0.5);
      fillCells(g, dots.filter(d => d.recent).map(at), TRAIL_RECENT_COLOR, 0.5);
    },
    setInvert: (key, cells) => {
      const g = invertLayer.get(key);
      g.clear();
      if (!cells) return;
      fillCells(g, cells.white, PALETTE.white);
      fillCells(g, cells.black, PALETTE.black);
    },
    destroy: () => container.destroy({ children: true }),
  };
};
