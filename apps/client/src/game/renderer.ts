import { createTargetView } from "./targetView";
import type { Target } from "@/practice/rules";
import { createPixelWind } from "./pixelWind";
import { createPixelBackdrop } from "./pixelBackdrop";
import type { TerrainOp } from "@game/protocol";
import { createImageTerrainLayer } from "./imageTerrainLayer";
import { fitTankLabel } from "./tankLabelLayout";
import { COLOR_HEX, type TankColors, type WeaponId } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { Application, Container, Graphics, type Texture } from "pixi.js";
import { type EdgeSide, edgeMarker } from "./edgeMarker";
import { spawnDamageLabel } from "./damageLabel";
import { DAMAGE_LABEL_GAP_PX, type Offset } from "./hitFeedback";
import { createProjectileView, type ProjectileView } from "./projectileView";
import type { Layout } from "./scale";
import { createTankView, type TankPose, type TankView } from "./tankView";
import { createTerrainLayer, type TerrainLayer } from "./terrainLayer";

// PixiJS の Application を 1 つ持ち、地形、戦車、弾の層をまとめる。
// world はセル単位で描き、cell 倍に拡大する。名前の文字だけは拡大しない層に置く。

export type Renderer = {
  readonly app: Application;
  readonly setTargets: (targets: readonly Target[]) => void;
  readonly setLayout: (layout: Layout) => void;
  /** 表示だけを移動する。物理座標と倍率は変えない */
  readonly setCameraOffset: (x: number, y: number) => void;
  readonly setTerrain: (mask: TerrainMask, cut?: TerrainOp, history?: readonly TerrainOp[]) => void;
  readonly setTank: (seat: number, pose: TankPose) => void;
  /** 弾の層を作り直す。色は撃つ側の主色、大きさは武器で決まる */
  readonly projectile: (color: TankColors["primary"], weapon: WeaponId) => ProjectileView;
  readonly onFrame: (fn: (deltaMs: number) => void) => () => void;
  /** 画面全体を整数セルだけずらす。着弾の揺れに使う */
  readonly setShake: (offset: Offset) => void;
  /** 機体の上にダメージ数字を出す。数字は自分で浮いて消える */
  readonly showDamage: (seat: number, text: string, color: TankColors["primary"], big: boolean, summary?: boolean) => void;
  /** 前の射撃の軌跡（セル）。設計書 38 の E7。null なら消す */
  readonly setGuide: (dots: readonly { readonly x: number; readonly y: number }[] | null) => void;
  /** 画面の外で被弾した機体の印。位置はセル。設計書 38 の E6。on が偽なら消す */
  readonly setEdgeMarkers: (points: readonly EdgePoint[], on: boolean) => void;
  /** 地形を上から rows 行だけ見せる。null なら全体。設計書 38 の L3 */
  readonly setReveal: (rows: number | null) => void;
  readonly destroy: () => void;
};

export type EdgePoint = { readonly x: number; readonly y: number; readonly color: number };

/** 前の射撃の軌跡の色 */
const GUIDE_COLOR = 0x1f8a42;
/** 画面の外の印のドット（px） */
const EDGE_DOT = 2;

/** 外へ向く三角。幅 5、3、1 ドット。先端が side の向き */
const drawEdgeArrow = (g: Graphics, x: number, y: number, side: EdgeSide, color: number): void => {
  [5, 3, 1].forEach((w, i) => {
    const across = (-w * EDGE_DOT) / 2, along = (i - 1) * EDGE_DOT;
    if (side === "left") g.rect(x - along, y + across, EDGE_DOT, w * EDGE_DOT);
    else if (side === "right") g.rect(x + along, y + across, EDGE_DOT, w * EDGE_DOT);
    else if (side === "up") g.rect(x + across, y - along, w * EDGE_DOT, EDGE_DOT);
    else g.rect(x + across, y + along, w * EDGE_DOT, EDGE_DOT);
  });
  g.fill(color);
};

export type RendererInit = {
  readonly mapId?: string | undefined;
  readonly wind?: () => number;
  readonly host: HTMLElement;
  readonly layout: Layout;
  readonly mask: TerrainMask;
  readonly impactTextures?: Readonly<Record<WeaponId, readonly Texture[]>>;
  readonly projectileTextures?: Readonly<Record<WeaponId, Texture>>;
  readonly tankFactory?: typeof createTankView;
  readonly background?: number;
  readonly terrainTint?: number;
  readonly backgroundAlpha?: number;
  readonly imageTerrain?: CanvasImageSource;
  readonly terrainArt?: CanvasImageSource;
  readonly players: readonly { colors: TankColors; nickname: string }[];
};

const safely = (fn: () => void): void => {
  try {
    fn();
  } catch (e) {
    console.warn("renderer の破棄で例外", e);
  }
};

export const createRenderer = async (init: RendererInit): Promise<Renderer> => {
  const app = new Application();
  await app.init({
    width: init.layout.mapWidth,
    height: init.layout.mapHeight,
    background: init.background ?? 0x000000,
    backgroundAlpha: init.backgroundAlpha ?? 1,
    antialias: false,
    resolution: 1,
    autoDensity: false,
    preference: "webgl",
  });
  init.host.appendChild(app.canvas);

  let cell = init.layout.cell;
  const world = new Container();
  const labels = new Container();
  world.scale.set(cell);
  const backdrop = createPixelBackdrop(init.mapId ?? "ridgeline");
  const wind = createPixelWind();
  app.stage.addChild(backdrop.container, wind.container, world, labels);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  app.ticker.add(() => wind.update(app.ticker.deltaMS, init.wind?.() ?? 0, app.screen.width, app.screen.height, reduced.matches || !init.wind));

  const terrain: TerrainLayer = init.imageTerrain ? createImageTerrainLayer(init.mask, init.imageTerrain) : createTerrainLayer(init.mask, init.terrainArt);
  world.addChild(terrain.sprite);
  terrain.sprite.tint = init.terrainTint ?? 0xffffff;

  const targets = createTargetView();
  world.addChild(targets.graphics);
  const guide = new Graphics();
  world.addChild(guide);
  const reveal = new Graphics();
  world.addChild(reveal);
  const edges = new Graphics();
  const projectileLayer = new Container();
  world.addChild(projectileLayer);
  let projectile: ProjectileView | null = null;

  const tanks: readonly TankView[] = init.players.map(player =>
    (init.tankFactory ?? createTankView)(player.colors, player.nickname));
  for (const t of tanks) {
    world.addChild(t.world);
    labels.addChild(t.label);
  }
  app.stage.addChild(edges);
  app.ticker.add(() => {
    for (const t of tanks) t.tick?.(app.ticker.deltaMS, reduced.matches);
  });
  const poses: (TankPose | null)[] = tanks.map(() => null);
  const labelStops = new Set<() => void>();
  const labelOrigins = tanks.map(() => ({ x: 0, y: 0 }));
  const placeLabel = (seat: number): void => {
    const pose = poses[seat];
    if (!pose) return;
    const label = tanks[seat]!.label, origin = labelOrigins[seat]!;
    const point = fitTankLabel({ x: origin.x + labels.x, y: origin.y + labels.y },
      { x: (pose.x + 0.5) * cell + world.x, y: pose.y * cell + world.y },
      label.getLocalBounds(), app.screen);
    label.position.set(point.x - labels.x, point.y - labels.y);
  };

  const applyPose = (seat: number): void => {
    const pose = poses[seat];
    if (pose) {
      tanks[seat]!.setPose(pose, cell);
      labelOrigins[seat] = { x: tanks[seat]!.label.x, y: tanks[seat]!.label.y };
      placeLabel(seat);
    }
  };

  return {
    app,
    setTargets: targets.update,
    setLayout: (layout) => {
      cell = layout.cell;
      world.scale.set(cell);
      app.renderer.resize(layout.mapWidth, layout.mapHeight);
      tanks.forEach((_, index) => applyPose(index));
    },
    setCameraOffset: (x, y) => {
      world.position.set(x, y);
      wind.setCameraOffset(x, y);
      backdrop.update(x, y, cell, app.screen.width, app.screen.height);
      labels.position.set(x, y);
      tanks.forEach((_, index) => placeLabel(index));
    },
    setTerrain: (mask, cut, history) => terrain.update(mask, cut, history),
    setTank: (seat, pose) => {
      poses[seat] = pose;
      applyPose(seat);
    },
    projectile: (color, weapon) => {
      if (projectile) projectile.destroy();
      projectile = createProjectileView(Number.parseInt(COLOR_HEX[color].slice(1), 16), weapon, init.projectileTextures?.[weapon], init.impactTextures?.[weapon]);
      projectileLayer.addChild(projectile.container);
      return projectile;
    },
    onFrame: (fn) => {
      const handler = (): void => fn(app.ticker.deltaMS);
      app.ticker.add(handler);
      return () => {
        app.ticker.remove(handler);
      };
    },
    setShake: (offset) => {
      app.stage.position.set(offset.dx * cell, offset.dy * cell);
    },
    showDamage: (seat, text, color, big, summary = false) => {
      const pose = poses[seat];
      if (!pose) return;
      // 名前の文字の上端から隙間を空けて出す。名前は px で描かれるので px で積む
      const y = tanks[seat]!.label.getBounds().minY - labels.getGlobalPosition().y - DAMAGE_LABEL_GAP_PX;
      const stop = spawnDamageLabel({ parent: labels, ticker: app.ticker, text, color, big, summary, x: (pose.x + 0.5) * cell, y, onEnd: () => labelStops.delete(stop) });
      labelStops.add(stop);
    },
    setGuide: (dots) => {
      guide.clear();
      if (!dots || dots.length === 0) return;
      for (const d of dots) guide.rect(d.x - 0.25, d.y - 0.25, 0.5, 0.5);
      guide.fill(GUIDE_COLOR);
    },
    setEdgeMarkers: (points, on) => {
      edges.clear();
      edges.position.set(-app.stage.x, -app.stage.y);
      if (!on) return;
      for (const p of points) {
        const marker = edgeMarker({ x: (p.x + 0.5) * cell + world.x, y: p.y * cell + world.y }, app.screen);
        if (marker) drawEdgeArrow(edges, marker.x, marker.y, marker.side, p.color);
      }
    },
    setReveal: (rows) => {
      reveal.clear();
      if (rows === null) { terrain.sprite.mask = null; reveal.visible = false; return; }
      reveal.rect(0, 0, terrain.sprite.width || 10000, Math.max(0, rows)).fill(0xffffff);
      reveal.visible = true;
      terrain.sprite.mask = reveal;
    },
    destroy: () => {
      for (const stop of labelStops) safely(stop);
      labelStops.clear();
      // PixiJS v8 の Text は破棄時にテクスチャプールへの返却で例外を出すことがある。撤収なので握りつぶす
      safely(() => terrain.destroy());
      for (const t of tanks) safely(() => t.destroy());
      const p = projectile;
      if (p) safely(() => p.destroy());
      safely(() => app.destroy(true, { children: true }));
    },
  };
};
