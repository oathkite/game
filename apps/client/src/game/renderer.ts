import { createTargetView } from "./targetView";
import type { Target } from "@/practice/rules";
import { createPixelWind } from "./pixelWind";
import { backdropTheme, createPixelBackdrop } from "./pixelBackdrop";
import type { TerrainOp } from "@game/protocol";
import { createImageTerrainLayer } from "./imageTerrainLayer";
import { fitTankLabel } from "./tankLabelLayout";
import type { TankColors, WeaponId } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { Application, Container, Graphics, type Texture } from "pixi.js";
import { type EdgeSide, edgeMarker } from "./edgeMarker";
import { spawnDamageLabel } from "./damageLabel";
import { DAMAGE_LABEL_GAP_PX, type Offset } from "./hitFeedback";
import { createProjectileView, type ProjectileView } from "./projectileView";
import { createExplosionTextures } from "./explosionTextures";
import { PALETTE, TEAM_RAMPS } from "./palette";
import type { Layout } from "./scale";
import { createTankView, type TankPose, type TankView } from "./tankView";
import { createTerrainLayer, type TerrainLayer } from "./terrainLayer";
import { createFxLayer } from "./fx/fxLayer";
import type { ArtBounds } from "./fx/particles";
import { createDimLayer, createFlashLayer, createRendererEffects, type RendererEffects } from "./fx/rendererEffects";
import { ART_PER_CELL } from "./pixelGrid";

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
  /** 再生の外で寿命が尽きるまで描く演出。設計書 41 */
  readonly effects: RendererEffects;
  readonly destroy: () => void;
};

export type { RendererEffects };

/** 粒を描く範囲の余白（art px）。画面揺れでずれた分も描く */
const FX_MARGIN = 8;

export type EdgePoint = { readonly x: number; readonly y: number; readonly color: number };

/** 前の射撃の軌跡の色。飛翔中の軌跡の古い点と同じ緑（設計書 40.8） */
const GUIDE_COLOR = PALETTE.greenMid;
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
  /** 偽なら描画の時計を自分では進めない。FX ラボの決めた時刻の絵に使う（設計書 41.11） */
  readonly autoStart?: boolean;
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
    autoStart: init.autoStart ?? true,
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
  app.ticker.add(() => backdrop.tick(app.ticker.deltaMS, reduced.matches));

  const theme = backdropTheme(init.mapId ?? "ridgeline");
  const terrain: TerrainLayer = init.imageTerrain ? createImageTerrainLayer(init.mask, init.imageTerrain) : createTerrainLayer(init.mask, init.terrainArt, theme);
  // 爆発の絵は描画を閉じるまで使い回す（設計書 40.11）
  const explosions = createExplosionTextures();
  world.addChild(terrain.sprite);
  terrain.sprite.tint = init.terrainTint ?? 0xffffff;

  const targets = createTargetView();
  world.addChild(targets.graphics);
  const guide = new Graphics();
  world.addChild(guide);
  const reveal = new Graphics();
  world.addChild(reveal);
  const edges = new Graphics();
  // 大きな着弾の暗転（設計書 41.6 の I5）。地形と背景の上、光と火球と機体の下
  const dim = createDimLayer(init.mask.width, init.mask.height);
  world.addChild(dim);
  // 手番をまたいで残る粒。地形より手前で、爆風と機体より奥（設計書 41.9）。火球の中の破片は火球に隠れ、外へ出たものが見える
  const fx = createFxLayer();
  world.addChild(fx.back);
  const projectileLayer = new Container();
  world.addChild(projectileLayer);
  let projectile: ProjectileView | null = null;

  const tanks: readonly TankView[] = init.players.map(player =>
    (init.tankFactory ?? createTankView)(player.colors, player.nickname));
  for (const t of tanks) {
    world.addChild(t.world);
    labels.addChild(t.label);
  }
  world.addChild(fx.front);
  app.stage.addChild(edges);
  const flash = createFlashLayer();
  app.stage.addChild(flash);
  /** 見えている範囲（art px） */
  const viewArt = (): ArtBounds => {
    const left = -world.x / cell, top = -world.y / cell;
    return {
      left: Math.floor(left * ART_PER_CELL) - FX_MARGIN,
      top: Math.floor(top * ART_PER_CELL) - FX_MARGIN,
      right: Math.ceil((left + app.screen.width / cell) * ART_PER_CELL) + FX_MARGIN,
      bottom: Math.ceil((top + app.screen.height / cell) * ART_PER_CELL) + FX_MARGIN,
    };
  };
  const effects = createRendererEffects({ fx, texels: terrain.texels, dim, flash, screen: () => app.screen, reduced: () => reduced.matches });
  app.ticker.add(() => { fx.tick(app.ticker.deltaMS, viewArt()); effects.tick(); });
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
      projectile = createProjectileView({ ramp: TEAM_RAMPS[color], explosions }, weapon, init.projectileTextures?.[weapon], init.impactTextures?.[weapon]);
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
      // 2 × 2 art px の点を art px の格子に揃える
      for (const d of dots) guide.rect(Math.round((d.x - 0.25) * 4) / 4, Math.round((d.y - 0.25) * 4) / 4, 0.5, 0.5);
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
    effects,
    destroy: () => {
      for (const stop of labelStops) safely(stop);
      labelStops.clear();
      // PixiJS v8 の Text は破棄時にテクスチャプールへの返却で例外を出すことがある。撤収なので握りつぶす
      safely(() => terrain.destroy());
      for (const t of tanks) safely(() => t.destroy());
      const p = projectile;
      if (p) safely(() => p.destroy());
      safely(() => app.destroy(true, { children: true }));
      safely(() => backdrop.destroy());
      safely(() => explosions.destroy());
    },
  };
};
