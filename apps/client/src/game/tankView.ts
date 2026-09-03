import { COLOR_HEX, type Facing, type TankColors } from "@game/protocol";
import { BARREL_BASE_UP, BARREL_LENGTH, HP_MAX } from "@game/sim";
import { Container, Graphics, Text } from "pixi.js";

// 戦車のドット絵。設計書 08 の 8.6。幅 7、高さ 5 の正方形の集まりと主砲を 1 つのコンテナにまとめて回す。
// 座標の単位はセルで、親のコンテナで整数倍に拡大する。

export type TankPose = {
  readonly x: number;
  /** 接地点の y。落下の演出では小数になる */
  readonly y: number;
  readonly tilt: number;
  readonly facing: Facing;
  readonly elevation: number;
  readonly hp: number;
  readonly visible: boolean;
  readonly flash: boolean;
};

export type TankView = {
  readonly world: Container;
  /** 名前は拡大しない層に置く */
  readonly label: Container;
  readonly setPose: (pose: TankPose, cell: number) => void;
  readonly destroy: () => void;
};

const DEG = Math.PI / 180;
const BODY_W = 7;

const hex = (c: string): number => Number.parseInt(c.slice(1), 16);

const drawBody = (g: Graphics, colors: TankColors, white: boolean): void => {
  g.clear();
  const primary = white ? 0xffffff : hex(COLOR_HEX[colors.primary]);
  const secondary = white ? 0xffffff : hex(COLOR_HEX[colors.secondary]);
  // 下 3 段が車体（主色）、上 2 段が砲塔（副色）
  g.rect(-BODY_W / 2, -3, BODY_W, 3).fill(primary);
  g.rect(-2.5, -5, 5, 2).fill(secondary);
};

export const createTankView = (colors: TankColors, nickname: string): TankView => {
  const world = new Container();
  const body = new Graphics();
  drawBody(body, colors, false);
  const barrel = new Graphics();
  barrel.rect(0, -0.5, BARREL_LENGTH, 1).fill(hex(COLOR_HEX[colors.secondary]));
  barrel.position.set(0, -BARREL_BASE_UP);
  const rotating = new Container();
  rotating.addChild(body, barrel);
  world.addChild(rotating);

  // HP バー。横 12、縦 3 の黒い下地の中に、主色で 10 HP を 1 セルとして描く
  const hpBar = new Graphics();
  world.addChild(hpBar);

  const label = new Container();
  const labelBg = new Graphics();
  const text = new Text({
    text: nickname,
    style: { fontFamily: "DotGothic16, monospace", fontSize: 16, fill: COLOR_HEX[colors.primary] },
    resolution: 1,
  });
  text.anchor.set(0.5, 1);
  label.addChild(labelBg, text);

  let wasWhite = false;

  const setPose = (pose: TankPose, cell: number): void => {
    world.visible = pose.visible;
    label.visible = pose.visible;
    world.position.set(pose.x + 0.5, pose.y);
    rotating.rotation = -pose.tilt * DEG;
    const local = pose.facing === 1 ? pose.elevation : 180 - pose.elevation;
    barrel.rotation = -local * DEG;
    if (pose.flash !== wasWhite) {
      drawBody(body, colors, pose.flash);
      wasWhite = pose.flash;
    }
    hpBar.clear();
    hpBar.rect(-6, 1, 12, 3).fill(0x000000);
    const cells = Math.min(10, Math.ceil(Math.max(0, pose.hp) / (HP_MAX / 10)));
    if (cells > 0) hpBar.rect(-5, 2, cells, 1).fill(hex(COLOR_HEX[colors.primary]));

    label.position.set((pose.x + 0.5) * cell, (pose.y - 9) * cell);
    labelBg.clear();
    labelBg.rect(-text.width / 2 - 2, -text.height, text.width + 4, text.height).fill(0x000000);
  };

  return {
    world,
    label,
    setPose,
    destroy: () => {
      world.destroy({ children: true });
      label.destroy({ children: true });
    },
  };
};
