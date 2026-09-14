import { Container, Graphics } from "pixi.js";

export const backdropTheme = (mapId: string) => {
  if (mapId === "stone-bridge" || mapId === "rock-arch") return "canyon";
  if (mapId === "terraces" || mapId === "reed-hills") return "basin";
  if (mapId === "sky-islands") return "islands";
  return "ridge";
};

/** Fixed pixel scenery sits behind wind and terrain; only its transforms move. */
export const createPixelBackdrop = (mapId: string) => {
  const container = new Container(), theme = backdropTheme(mapId);
  const layers = [0.12, 0.28].map((speed, layer) => {
    const graphic = new Graphics(), base = layer ? 0x092719 : 0x05160e;
    if (theme === "islands") {
      for (let i = -9; i < 18; i++) {
        const x = i * 98, y = 28 + ((i * i * 17 + layer * 53) % 145);
        const width = 28 + ((i * i * 7) % 38);
        graphic.rect(x, y, width, 4).rect(x + 4, y + 4, width - 8, 8)
          .rect(x + 10, y + 12, width - 20, 8).rect(x + width / 2 - 4, y + 20, 8, 8);
      }
      graphic.fill(base);
      for (let i = -8; i < 18; i++) {
        const x = i * 127, y = 16 + ((i * i * 13 + layer * 37) % 130);
        graphic.rect(x, y, 44, 4).rect(x + 8, y - 4, 24, 4);
      }
      graphic.fill(layer ? 0x103326 : 0x081e17);
    } else {
      for (let x = -1000; x < 2200; x += 4) {
        const ridge = theme === "ridge" ? 80 + Math.abs(Math.sin(x / 120 + layer)) * 65 + Math.sin(x / 29) * 10
          : theme === "canyon" ? 70 + Math.floor((Math.sin(x / 87 + layer) + 1) * 3) * 16
          : 85 + Math.cos(x / 235 + layer) * 48 + Math.floor(Math.sin(x / 41) * 3) * 4;
        const y = Math.round((ridge + layer * 38) / 4) * 4;
        graphic.rect(x, y, 4, 600 - y);
      }
      graphic.fill(base);
      if (theme === "canyon") {
        // Distant aqueduct segments: solid piers with open gaps, never terrain.
        for (let x = -900; x < 2100; x += 180) {
          graphic.rect(x, 70 + layer * 50, 104, 8);
          for (let j = 0; j < 3; j++) graphic.rect(x + j * 44, 78 + layer * 50, 16, 64);
        }
      } else if (theme === "basin") {
        for (let x = -960; x < 2100; x += 80) for (let j = 0; j < 3; j++)
          graphic.rect(x, 160 + j * 24 + Math.round(Math.cos(x / 235 + layer) * 12) * 4, 48, 2);
      } else {
        for (let x = -900; x < 2100; x += 120) graphic.rect(x, 184 + Math.round(Math.sin(x / 120) * 8) * 4, 32, 2);
      }
      graphic.fill(layer ? 0x103521 : 0x0a2115);
    }
    container.addChild(graphic);
    return { graphic, speed };
  });
  return { container, update: (x: number, y: number, scale: number, width: number, height: number) => {
    for (const { graphic, speed } of layers) {
      graphic.scale.set(Math.max(1, scale * 0.4));
      graphic.position.set(Math.round(width / 2 + (x - width / 2) * speed), Math.round(height * 0.28 + (y - height / 2) * speed));
    }
  } };
};
