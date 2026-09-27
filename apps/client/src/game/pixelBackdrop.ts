import { Container, Graphics, Sprite, Texture, TilingSprite } from "pixi.js";
import { PALETTE } from "./palette";
import { toRgba, type PixelGrid } from "./pixelGrid";
import { paintMountains, paintSky, paintTrees, SKY_THEMES, skyStars, TREE_HEIGHT, twinkleOn, type SkyTheme, type Star } from "./skyPaint";
import { createDriftLights } from "./driftLights";

// 背景の夜空、月、星、山並み。設計書 40.7。地形と風の粒の後ろに置き、当たり判定には含めない。
// 夜空と月は画面に固定し、山並みはカメラの 12% と 28% で横に流す。描いた絵は texture にして、毎フレームは位置だけを動かす。

export const backdropTheme = (mapId: string): SkyTheme => {
  if (mapId === "stone-bridge" || mapId === "rock-arch") return "canyon";
  if (mapId === "terraces" || mapId === "reed-hills") return "basin";
  if (mapId === "sky-islands") return "islands";
  return "ridge";
};

/** 背景の 1 art px の CSS px。対戦の既定倍率の art px と同じ大きさにする */
const PX = 2;
/** 山並みの縦の位置を決める基準の地表（セル）。カメラがここを見ているとき、上端が anchor の高さに来る */
const REFERENCE_GROUND = 145;
// 3 層目（木々と柱）は設計書 41 の段階 6 で足した。カメラの 50% で動く
const LAYERS = [
  { speed: 0.12, height: 96, anchor: 0.34 },
  { speed: 0.28, height: 80, anchor: 0.46 },
  { speed: 0.5, height: TREE_HEIGHT, anchor: 0.5 },
] as const;

const textureOf = (grid: PixelGrid): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = grid.width;
  canvas.height = grid.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context がない");
  const image = ctx.createImageData(grid.width, grid.height);
  toRgba(grid, image.data);
  ctx.putImageData(image, 0, 0);
  const texture = Texture.from(canvas);
  texture.source.scaleMode = "nearest";
  return texture;
};

type Mountain = { readonly tiling: TilingSprite; readonly below: Graphics; readonly texture: Texture; readonly speed: number; readonly height: number; readonly anchor: number; readonly fill: number };

const createMountains = (theme: SkyTheme, container: Container): readonly Mountain[] => LAYERS.map((layer, i) => {
  const texture = textureOf(i === 2 ? paintTrees(theme, layer.height) : paintMountains(theme, i === 0 ? 0 : 1, layer.height));
  const tiling = new TilingSprite({ texture, width: 1, height: layer.height });
  tiling.scale.set(PX);
  // 山並みの下は同じ色で画面の下端まで塗り、空の帯が覗かないようにする。浮島は宙に浮くので塗らない
  const below = new Graphics();
  container.addChild(tiling, below);
  const fill = i === 0 ? SKY_THEMES[theme].far.fill : i === 1 ? SKY_THEMES[theme].near.fill : PALETTE.sky0;
  return { tiling, below, texture, ...layer, fill };
});

export const createPixelBackdrop = (mapId: string) => {
  const theme = backdropTheme(mapId);
  const container = new Container();
  const sky = new Sprite(Texture.EMPTY);
  sky.scale.set(PX);
  const stars = new Graphics();
  container.addChild(sky, stars);
  const mountains = createMountains(theme, container);
  // 漂う光（設計書 41 の段階 6）。遠景の前、地形の後ろ。風では動かさない
  const lights = createDriftLights(theme, PX);
  container.addChild(lights.graphics);
  let size = "", skyTexture: Texture | null = null, starList: readonly Star[] = [], clock = 0, reduced = false, twinkleKey = "";
  const drawStars = (): void => {
    const key = starList.map(s => (!s.twinkle || twinkleOn(s.index, clock, reduced) ? "1" : "0")).join("");
    if (key === twinkleKey) return;
    twinkleKey = key;
    stars.clear();
    starList.forEach((s, i) => stars.rect(s.x * PX, s.y * PX, PX, PX).fill(key[i] === "1" ? s.color : PALETTE.starFaint));
  };
  const resize = (width: number, height: number): void => {
    const w = Math.ceil(width / PX), h = Math.ceil(height / PX), key = `${w}x${h}`;
    if (key === size) return;
    size = key;
    skyTexture?.destroy(true);
    skyTexture = textureOf(paintSky(theme, w, h));
    sky.texture = skyTexture;
    starList = skyStars(theme, w, h);
    twinkleKey = "";
    drawStars();
    for (const m of mountains) m.tiling.width = w + 1;
    lights.resize(width, height);
  };
  return {
    container,
    /** カメラのずらし（x, y、CSS px）とセルの倍率から、山並みの位置を決める */
    update: (x: number, y: number, scale: number, width: number, height: number): void => {
      resize(width, height);
      for (const m of mountains) {
        m.tiling.tilePosition.x = Math.round((x * m.speed) / PX);
        const top = Math.round((height * m.anchor + (y - (height / 2 - REFERENCE_GROUND * scale)) * m.speed) / PX) * PX;
        m.tiling.y = top;
        m.below.clear();
        if (theme !== "islands" && top + m.height * PX < height) m.below.rect(0, top + m.height * PX, width, height - top - m.height * PX).fill(m.fill);
      }
      lights.setCamera(x);
    },
    /** 星の瞬き。状態が変わったときだけ描き直す */
    tick: (deltaMs: number, reducedMotion: boolean): void => {
      clock += deltaMs;
      reduced = reducedMotion;
      drawStars();
      lights.tick(deltaMs, reducedMotion);
    },
    destroy: (): void => {
      skyTexture?.destroy(true);
      for (const m of mountains) m.texture.destroy(true);
    },
  };
};
