import { Container, Graphics } from "pixi.js";

// 弾、飛行中の尾、爆風。設計書 08 の 8.6。単位はセル。

export type ProjectileView = {
  readonly container: Container;
  readonly setBullet: (x: number | null, y: number, angle: number) => void;
  readonly addTrail: (cx: number, cy: number) => void;
  readonly clear: () => void;
  /** 爆風。半径 r の円をセルで塗る。intensity は 0 から 1 で明滅に使う */
  readonly setBlast: (cx: number | null, cy: number, r: number, on: boolean) => void;
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
    setBlast: (cx, cy, r, on) => {
      blast.clear();
      if (cx === null || !on) return;
      const r2 = r * r;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r2) blast.rect(cx + dx, cy + dy, 1, 1);
        }
      }
      blast.fill(color);
    },
    destroy: () => container.destroy({ children: true }),
  };
};
