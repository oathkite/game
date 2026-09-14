import { Container, Graphics } from "pixi.js";

/** Wind drift plus a half-speed camera layer, composited behind solid terrain. */
export const createPixelWind = () => {
  const container = new Container();
  let cameraX = 0, cameraY = 0;
  const particles = Array.from({ length: 24 }, (_, i) => {
    const sprite = new Graphics().rect(0, 0, i % 3 === 0 ? 6 : 4, 4).fill(i % 3 === 0 ? 0x79cc96 : 0x4b9967);
    container.addChild(sprite);
    return { sprite, x: (i * .618) % 1, y: (i * .381) % 1 };
  });
  return {
    container,
    setCameraOffset: (x: number, y: number) => { cameraX = x * .5; cameraY = y * .5; },
    update: (deltaMs: number, wind: number, width: number, height: number, reduced: boolean) => {
      container.visible = !reduced;
      if (reduced) return;
      const dt = Math.min(50, deltaMs) / 1000;
      particles.forEach((p, i) => {
        p.x = (p.x + wind * dt * 9 / Math.max(1, width) + 1) % 1;
        p.y = (p.y + dt * (22 + i % 3 * 6) / Math.max(1, height)) % 1;
        const wrap = (value: number, size: number) => ((value % Math.max(1, size)) + Math.max(1, size)) % Math.max(1, size);
        p.sprite.position.set(Math.round(wrap(p.x * width + cameraX, width) / 2) * 2, Math.round(wrap(p.y * height + cameraY, height) / 2) * 2);
      });
    },
  };
};
