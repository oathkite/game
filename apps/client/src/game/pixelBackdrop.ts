import { Container, Graphics } from "pixi.js";

/** Static pixel silhouettes; only container transforms change while panning. */
export const createPixelBackdrop = (seed: number) => {
  const container = new Container();
  const layers = [0.16, 0.34].map((speed, layer) => {
    const graphic = new Graphics();
    for (let x = -800; x < 1600; x += 4) {
      const ridge = Math.sin(x / (layer ? 57 : 93) + seed) * 27 + Math.sin(x / 23 + seed) * 9;
      const top = Math.round((layer ? 115 : 80) + ridge);
      graphic.rect(x, top, 4, 400 - top);
    }
    graphic.fill(layer ? 0x092719 : 0x05160e);
    // Broken rock strata, spaced widely to keep the backdrop quiet.
    for (let x = -800; x < 1600; x += 31) {
      const ridge = (layer ? 115 : 80) + Math.sin(x / (layer ? 57 : 93) + seed) * 27 + Math.sin(x / 23 + seed) * 9;
      const y = Math.max(Math.ceil(ridge + 16), 160 + Math.round(Math.sin(x * 0.17 + seed) * 40));
      graphic.rect(x, y, 12 + Math.abs(x % 19), 1);
    }
    graphic.fill(layer ? 0x103521 : 0x0a2115);
    container.addChild(graphic);
    return { graphic, speed };
  });
  return {
    container,
    update: (x: number, y: number, scale: number, width: number, height: number) => {
      for (const { graphic, speed } of layers) {
        graphic.scale.set(Math.max(1, scale * 0.4));
        graphic.position.set(Math.round(width / 2 + (x - width / 2) * speed), Math.round(height * 0.28 + (y - height / 2) * speed));
      }
    },
  };
};
