import type { CellPoint, WeaponId } from "@game/protocol";
import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { blastCells, bulletSize, type BulletSize } from "./weaponArt";

// 弾、飛行中の尾、爆風、破片、外れの印。設計書 08 の 8.6、10 の 10.5。単位はセル。
// 1 発の射撃に弾は複数（扇）、爆風も複数（弾道 × 段）ありうるので、弾は添字で、爆風と破片と印は鍵で持つ。

export type ProjectileView = {
  readonly container: Container;
  /** 弾道 index の弾。x が null なら隠す */
  readonly setBullet: (index: number, x: number | null, y: number, angle: number) => void;
  readonly addTrail: (cx: number, cy: number) => void;
  readonly clear: () => void;
  /** 爆風。半径 r の円をセルで塗る。ring なら縁の 1 セルだけを残す。cx が null か on が偽なら消す */
  readonly setBlast: (key: string, cx: number | null, cy: number, r: number, on: boolean, ring?: boolean, frameIndex?: number) => void;
  /** 破片。1 セルの正方形を格子に揃えて置く */
  readonly setDebris: (key: string, cells: readonly CellPoint[]) => void;
  /** 外れの印。中心のセルと上下左右の 4 セルを塗る十字。cx が null か on が偽なら消す */
  readonly setMissMark: (key: string, cx: number | null, cy: number, on: boolean) => void;
  readonly destroy: () => void;
};

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

const drawBlast = (g: Graphics, color: number, cx: number, cy: number, r: number, ring: boolean): void => {
  for (const c of blastCells(cx, cy, r, ring)) g.rect(c.x, c.y, 1, 1);
  g.fill(color);
};

/** 弾の列。弾道の数だけ矩形を持ち、足りなければ作る */
const bulletPool = (parent: Container, size: BulletSize, color: number, texture?: Texture) => {
  const list: (Graphics | Sprite)[] = [];
  return (index: number): Graphics | Sprite => {
    while (list.length <= index) {
      const g = texture ? new Sprite(texture) : new Graphics().rect(-size.w / 2, -size.h / 2, size.w, size.h).fill(color);
      if (g instanceof Sprite) { g.anchor.set(0.5, 0.6); g.scale.set(1 / 12); }
      g.visible = false;
      parent.addChild(g);
      list.push(g);
    }
    return list[index] as Graphics;
  };
};

const drawMissMark = (g: Graphics, color: number, cx: number, cy: number): void => {
  g.rect(cx, cy, 1, 1).rect(cx - 1, cy, 1, 1).rect(cx + 1, cy, 1, 1).rect(cx, cy - 1, 1, 1).rect(cx, cy + 1, 1, 1).fill(color);
};

export const createProjectileView = (color: number, weapon: WeaponId, texture?: Texture, impactFrames?: readonly Texture[]): ProjectileView => {
  const container = new Container();
  const trail = new Graphics();
  const blasts = new Container();
  const debris = new Container();
  const misses = new Container();
  const bullets = new Container();
  container.addChild(trail, blasts, debris, misses, bullets);
  const blastLayer = keyedLayer(blasts);
  const impactSprites = new Map<string, Sprite>();
  const debrisLayer = keyedLayer(debris);
  const missLayer = keyedLayer(misses);
  const bulletAt = bulletPool(bullets, bulletSize(weapon), color, texture);

  return {
    container,
    setBullet: (index, x, y, angle) => {
      const g = bulletAt(index);
      g.visible = x !== null;
      if (x === null) return;
      g.position.set(x, y);
      g.rotation = angle;
    },
    addTrail: (cx, cy) => {
      trail.rect(cx, cy, 1, 1).fill(color);
    },
    clear: () => {
      trail.clear();
      blastLayer.clear();
      for (const sprite of impactSprites.values()) sprite.visible = false;
      debrisLayer.clear();
      missLayer.clear();
      bullets.children.forEach((g) => {
        g.visible = false;
      });
    },
    setBlast: (key, cx, cy, r, on, ring = false, frameIndex = 2) => {
      if (impactFrames) {
        let sprite = impactSprites.get(key);
        if (!sprite && cx !== null && on) {
          sprite = new Sprite(impactFrames[0]!); sprite.scale.set(1 / 12);
          blasts.addChild(sprite); impactSprites.set(key, sprite);
        }
        if (sprite) {
          sprite.visible = cx !== null && on;
          if (cx !== null) { sprite.texture = impactFrames[frameIndex]!; sprite.position.set(cx - 8, cy - 8); }
        }
        return;
      }
      const g = blastLayer.get(key);
      g.clear();
      if (cx === null || !on || r <= 0) return;
      drawBlast(g, color, cx, cy, r, ring);
    },
    setDebris: (key, cells) => {
      const g = debrisLayer.get(key);
      g.clear();
      if (cells.length === 0) return;
      for (const c of cells) g.rect(c.x, c.y, 1, 1);
      g.fill(color);
    },
    setMissMark: (key, cx, cy, on) => {
      const g = missLayer.get(key);
      g.clear();
      if (cx !== null && on) drawMissMark(g, color, cx, cy);
    },
    destroy: () => container.destroy({ children: true }),
  };
};
