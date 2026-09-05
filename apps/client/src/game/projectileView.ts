import { Container, Graphics } from "pixi.js";

// 弾、飛行中の尾、爆風。設計書 08 の 8.6。単位はセル。

export type ProjectileView = {
  readonly container: Container;
  readonly setBullet: (x: number | null, y: number, angle: number) => void;
  readonly addTrail: (cx: number, cy: number) => void;
  readonly clear: () => void;
  /** 爆風。半径 r の円をセルで塗る。ring なら縁の 1 セルだけを残す。on が偽なら消す */
  readonly setBlast: (cx: number | null, cy: number, r: number, on: boolean, ring?: boolean) => void;
  readonly destroy: () => void;
};

export const createProjectileView = (color: number): ProjectileView => {
  const container = new Container();
  const trail = new Graphics();
  const bullet = new Graphics();
  bullet.rect(-0.5, -0.5, 1, 1).fill(color);
  bullet.visible = false;
  const blast = new Graphics();
  container.addChild(trail, blast, bullet);

  return {
    container,
    setBullet: (x, y, angle) => {
      if (x === null) {
        bullet.visible = false;
        return;
      }
      bullet.visible = true;
      bullet.position.set(x, y);
      bullet.rotation = angle;
    },
    addTrail: (cx, cy) => {
      trail.rect(cx, cy, 1, 1).fill(color);
    },
    clear: () => {
      trail.clear();
      blast.clear();
      bullet.visible = false;
    },
    setBlast: (cx, cy, r, on, ring = false) => {
      blast.clear();
      if (cx === null || !on || r <= 0) return;
      const r2 = r * r;
      const inner = ring ? (r - 1) * (r - 1) : -1;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2 && d2 > inner) blast.rect(cx + dx, cy + dy, 1, 1);
        }
      }
      blast.fill(color);
    },
    destroy: () => container.destroy({ children: true }),
  };
};
