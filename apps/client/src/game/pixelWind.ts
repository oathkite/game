import { Container, Graphics } from "pixi.js";

/** Screen-space wind flecks, composited behind solid terrain. */
export const createPixelWind = () => {
  const container = new Container();
  const particles = Array.from({ length: 24 }, (_, i) => {
    const sprite = new Graphics().rect(0, 0, i % 3 === 0 ? 4 : 2, 2).fill(i % 3 === 0 ? 0x53a877 : 0x2b6944);
    container.addChild(sprite);
    return { sprite, x: (i * .618) % 1, y: (i * .381) % 1 };
  });
  return {
    container,
    update: (deltaMs: number, wind: number, width: number, height: number, reduced: boolean) => {
      container.visible = !reduced;
      if (reduced) return;
      const dt = Math.min(50, deltaMs) / 1000;
      particles.forEach((p, i) => {
        p.x = (p.x + wind * dt * 9 / Math.max(1, width) + 1) % 1;
        p.y = (p.y + dt * (22 + i % 3 * 6) / Math.max(1, height)) % 1;
        p.sprite.position.set(Math.round(p.x * width / 2) * 2, Math.round(p.y * height / 2) * 2);
      });
    },
  };
};
