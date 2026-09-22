import { drawTankWreck } from "./tankWreck";
import { createTurnCaret, placeTurnCaret } from "./turnCaret";
import { playSound } from "@/app/audio";
import { TANK_PIXELS, treadPixels } from "./tankPixels";
import type { ShotFlash } from "./muzzlePose";
import { COLOR_HEX, type Facing, type TankColors } from "@game/protocol";
import { BARREL_BASE_UP, BARREL_LENGTH, HP_MAX } from "@game/sim";
import { Container, Graphics, Text } from "pixi.js";

// 待機画面と共通のドット絵と主砲を 1 つのコンテナにまとめて回す。
// 武器で形は変えない（設計書 10 の 10.5）。
// 座標の単位はセルで、親のコンテナで整数倍に拡大する。

export type TankPose = {
  readonly x: number;
  /** 接地点の y。落下の演出では小数になる */
  readonly y: number;
  readonly tilt: number;
  readonly facing: Facing;
  readonly elevation: number;
  readonly hp: number;
  readonly falling?: boolean;
  readonly recoil?: number;
  readonly shotFlashes?: readonly ShotFlash[];
  /** 減る前の HP。hp より大きいとき、その差を失った区間として描く。省略なら hp と同じ */
  readonly hpGhost?: number;
  /** 失った区間を描くか。明滅に使う */
  readonly ghostOn?: boolean;
  readonly visible: boolean;
  readonly flash: boolean;
  /** 発射角の線を出す。自分が狙いを付けている間だけ true */
  readonly aiming: boolean;
};

export type TankView = {
  readonly world: Container;
  /** 名前は拡大しない層に置く */
  readonly label: Container;
  readonly setPose: (pose: TankPose, cell: number) => void;
  /** 毎フレームの時間経過。操作中のキャレットを動かす */
  readonly tick?: (deltaMs: number, reducedMotion: boolean) => void;
  readonly destroy: () => void;
};

const DEG = Math.PI / 180;
const hex = (c: string): number => Number.parseInt(c.slice(1), 16);

const drawBody = (g: Graphics, colors: { readonly primary: string; readonly secondary: string }, white: boolean, distance: number): void => {
  g.clear();
  for (const p of TANK_PIXELS) g.rect((p.x - 38) / 8, (p.y - 53) / 8, p.w / 8, p.h / 8).fill(white ? 0xffffff : hex(p.part === "body" ? colors.primary : colors.secondary));
  for (const p of treadPixels(distance)) g.rect((p.x - 38) / 8, (p.y - 53) / 8, p.w / 8, p.h / 8).fill(0x000000);
};

const hpCells = (hp: number): number => Math.min(10, Math.ceil(Math.max(0, hp) / (HP_MAX / 10)));

/** 接地点の2セル下に、10 HP を1セルとして描く。失った区間は明滅で見せる */
const drawHpBar = (g: Graphics, colors: { readonly primary: string; readonly secondary: string }, pose: TankPose): void => {
  g.clear();
  const cells = hpCells(pose.hp);
  if (cells > 0) g.rect(-5, 2, cells, 1).fill(hex(colors.primary));
  const ghost = hpCells(pose.hpGhost ?? pose.hp);
  if (pose.ghostOn && ghost > cells) g.rect(-5 + cells, 2, ghost - cells, 1).fill(hex(colors.primary));
};

export const createTankView = (selection: TankColors, nickname: string, team?: string, showHealth = true): TankView => {
  const colors = { primary: COLOR_HEX[selection.primary], secondary: COLOR_HEX[selection.secondary] };
  const world = new Container();
  const body = new Graphics();
  drawBody(body, colors, false, 0);
  // 主砲。1 セル幅で長さは物理の主砲（4 セル）に揃える
  const barrel = new Graphics();
  barrel.rect(0, -0.5, BARREL_LENGTH, 1).fill(hex(colors.secondary));
  barrel.position.set(0, -BARREL_BASE_UP);
  const rotating = new Container();
  rotating.addChild(body, barrel);
  world.addChild(rotating);

  // 地形や車体の傾きに合わせて回転せず、タンクの下に水平表示する
  const hpBar = new Graphics();
  world.addChild(hpBar);

  const label = new Container();
  const text = new Text({
    text: nickname,
    style: { fontFamily: "DotGothic16, monospace", fontSize: 16, fill: team ?? colors.primary },
    resolution: 1,
  });
  text.anchor.set(0.5, 1);
  // 操作中の自機だけに出す。名前と同じ色で、誰の機体を動かしているかを名前に結び付ける
  const caret = createTurnCaret(hex(team ?? colors.primary));
  label.addChild(text, caret);
  let caretElapsed = 0;

  let wasWrecked = false;
  let wasWhite = false, distance = 0, previousX: number | null = null;

  const setPose = (pose: TankPose, cell: number): void => {
    const wrecked = pose.hp <= 0;
    barrel.visible = !wrecked;
    hpBar.visible = showHealth && !wrecked;
    text.style.fill = wrecked ? 0x929b96 : team ?? colors.primary;
    world.visible = pose.visible;
    label.visible = pose.visible;
    caret.visible = pose.aiming && !wrecked;
    world.position.set(pose.x + 0.5, pose.y);
    rotating.rotation = -pose.tilt * DEG;
    const local = pose.facing === 1 ? pose.elevation : 180 - pose.elevation;
    barrel.rotation = -local * DEG;
    const signedDelta = previousX === null ? 0 : pose.x - previousX;
    const delta = Math.abs(signedDelta);
    previousX = pose.x;
    const moving = !wrecked && pose.visible && !pose.falling && delta > .001 && delta <= 2.5;
    if (moving) { distance += signedDelta; playSound("move"); }
    if (moving || pose.flash !== wasWhite || wrecked !== wasWrecked) {
      if (wrecked) drawTankWreck(body);
      else drawBody(body, colors, pose.flash, distance);
      wasWrecked = wrecked;
      wasWhite = pose.flash;
    }
    drawHpBar(hpBar, { ...colors, primary: team ?? colors.primary }, pose);

    label.position.set((pose.x + 0.5) * cell, (pose.y - 12) * cell);
  };

  return {
    world,
    label,
    setPose,
    tick: (deltaMs, reducedMotion) => {
      caretElapsed = caret.visible ? caretElapsed + deltaMs : 0;
      placeTurnCaret(caret, caretElapsed, reducedMotion);
    },
    destroy: () => {
      world.destroy({ children: true });
      label.destroy({ children: true });
    },
  };
};
