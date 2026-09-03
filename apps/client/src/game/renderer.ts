import { COLOR_HEX, type Seat, type TankColors } from "@game/protocol";
import { MAP_HEIGHT, MAP_WIDTH, type TerrainMask } from "@game/sim";
import { Application, Container } from "pixi.js";
import { createProjectileView, type ProjectileView } from "./projectileView";
import type { Layout } from "./scale";
import { createTankView, type TankPose, type TankView } from "./tankView";
import { createTerrainLayer, type TerrainLayer } from "./terrainLayer";

// PixiJS の Application を 1 つ持ち、地形、戦車、弾の層をまとめる。
// world はセル単位で描き、cell 倍に拡大する。名前の文字だけは拡大しない層に置く。

export type Renderer = {
  readonly app: Application;
  readonly setLayout: (layout: Layout) => void;
  readonly setTerrain: (mask: TerrainMask) => void;
  readonly setTank: (seat: Seat, pose: TankPose) => void;
  readonly projectile: (color: TankColors["primary"]) => ProjectileView;
  readonly onFrame: (fn: (deltaMs: number) => void) => () => void;
  readonly destroy: () => void;
};

export type RendererInit = {
  readonly host: HTMLElement;
  readonly layout: Layout;
  readonly mask: TerrainMask;
  readonly players: readonly [{ colors: TankColors; nickname: string }, { colors: TankColors; nickname: string }];
};

export const createRenderer = async (init: RendererInit): Promise<Renderer> => {
  const app = new Application();
  await app.init({
    width: init.layout.mapWidth,
    height: init.layout.mapHeight,
    background: 0x000000,
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
  app.stage.addChild(world, labels);

  const terrain: TerrainLayer = createTerrainLayer(init.mask);
  world.addChild(terrain.sprite);

  const projectileLayer = new Container();
  world.addChild(projectileLayer);
  let projectile: ProjectileView | null = null;

  const tanks: readonly [TankView, TankView] = [
    createTankView(init.players[0].colors, init.players[0].nickname),
    createTankView(init.players[1].colors, init.players[1].nickname),
  ];
  for (const t of tanks) {
    world.addChild(t.world);
    labels.addChild(t.label);
  }
  const poses: [TankPose | null, TankPose | null] = [null, null];

  const applyPose = (seat: Seat): void => {
    const pose = poses[seat];
    if (pose) tanks[seat].setPose(pose, cell);
  };

  return {
    app,
    setLayout: (layout) => {
      cell = layout.cell;
      world.scale.set(cell);
      app.renderer.resize(MAP_WIDTH * cell, MAP_HEIGHT * cell);
      applyPose(0);
      applyPose(1);
    },
    setTerrain: (mask) => terrain.update(mask),
    setTank: (seat, pose) => {
      poses[seat] = pose;
      applyPose(seat);
    },
    projectile: (color) => {
      if (projectile) projectile.destroy();
      projectile = createProjectileView(Number.parseInt(COLOR_HEX[color].slice(1), 16));
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
    destroy: () => {
      terrain.destroy();
      for (const t of tanks) t.destroy();
      if (projectile) projectile.destroy();
      app.destroy(true, { children: true });
    },
  };
};
