import { drawTankWreck } from "./tankWreck";
import { createTurnCaret, placeTurnCaret } from "./turnCaret";
import { playSound } from "@/app/audio";
import { TANK_PIXELS, treadPixels } from "./tankPixels";
import type { ShotFlash } from "./muzzlePose";
import { COLOR_HEX, type Facing, type TankColors } from "@game/protocol";
import { BARREL_BASE_UP, BARREL_LENGTH, HP_MAX } from "@game/sim";
import { Container, Graphics, Text } from "pixi.js";
import { chargeAt, idleRumble, landingAt, LOW_HP, wreckFrameAt, WRECK_SMOKE_FROM_MS } from "./tankMotion";
import { drawBursts, drawDust, drawLowHpSmoke, drawWreckSmoke } from "./tankFx";

// 待機画面と共通のドット絵と主砲を 1 つのコンテナにまとめて回す。
// 武器で形は変えない（設計書 10 の 10.5）。
// 座標の単位はセルで、親のコンテナで整数倍に拡大する。
// 手番の振動、着地、HP が少ないときの煙、撃破、パワーの溜めは設計書 38。時間は tick で進める自前の時計で測る。

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
  /** この機体の手番。名前の上にキャレットを出し、誰の番かを全員に見せる */
  readonly acting?: boolean;
  /** 溜めているパワー（0〜1）。自分が溜めている間だけ渡す */
  readonly charge?: number;
};

export type TankView = {
  readonly world: Container;
  /** 名前は拡大しない層に置く */
  readonly label: Container;
  readonly setPose: (pose: TankPose, cell: number) => void;
  /** 毎フレームの時間経過。キャレットと機体の演出を動かす */
  readonly tick?: (deltaMs: number, reducedMotion: boolean) => void;
  readonly destroy: () => void;
};

const DEG = Math.PI / 180;
const ART = 1 / 8;
const WRECK_GREY = 0x69716e;
const CHARGE_COLOR = 0x33ff66;
const CHARGE_HOT_COLOR = 0xffe14d;
/** 残骸の砲身が垂れる角度 */
const WRECK_DROOP = 18;
const hex = (c: string): number => Number.parseInt(c.slice(1), 16);

type Colors = { readonly primary: string; readonly secondary: string };

const drawHull = (g: Graphics, colors: Colors, white: boolean): void => {
  g.clear();
  for (const p of TANK_PIXELS) g.rect((p.x - 38) / 8, (p.y - 53) / 8, p.w / 8, p.h / 8).fill(white ? 0xffffff : hex(p.part === "body" ? colors.primary : colors.secondary));
};

const drawTread = (g: Graphics, distance: number): void => {
  g.clear();
  for (const p of treadPixels(distance)) g.rect((p.x - 38) / 8, (p.y - 53) / 8, p.w / 8, p.h / 8).fill(0x000000);
};

const hpCells = (hp: number): number => Math.min(10, Math.ceil(Math.max(0, hp) / (HP_MAX / 10)));

/** 接地点の2セル下に、10 HP を1セルとして描く。失った区間は明滅で見せる */
const drawHpBar = (g: Graphics, colors: Colors, pose: TankPose): void => {
  g.clear();
  const cells = hpCells(pose.hp);
  if (cells > 0) g.rect(-5, 2, cells, 1).fill(hex(colors.primary));
  const ghost = hpCells(pose.hpGhost ?? pose.hp);
  if (pose.ghostOn && ghost > cells) g.rect(-5 + cells, 2, ghost - cells, 1).fill(hex(colors.primary));
};

/** 状態の変わり目の時刻。setPose で記録し、tick の時計で経過を測る */
type Moments = { first: boolean; hp: number; deathAt: number | null; falling: boolean; landAt: number | null };

const noteMoments = (m: Moments, pose: TankPose, clock: number): void => {
  if (!m.first && m.hp > 0 && pose.hp <= 0) m.deathAt = clock;
  if (pose.hp > 0) m.deathAt = null;
  if (m.falling && !pose.falling && pose.hp > 0) m.landAt = clock;
  m.first = false;
  m.hp = pose.hp;
  m.falling = pose.falling === true;
};

export const createTankView = (selection: TankColors, nickname: string, team?: string, showHealth = true): TankView => {
  const colors = { primary: COLOR_HEX[selection.primary], secondary: COLOR_HEX[selection.secondary] };
  const world = new Container();
  const hull = new Container();
  const body = new Graphics();
  const tread = new Graphics();
  drawHull(body, colors, false);
  drawTread(tread, 0);
  // 主砲。1 セル幅で長さは物理の主砲（4 セル）に揃える。溜めの点は砲身と一緒に回す
  const arm = new Container();
  arm.position.set(0, -BARREL_BASE_UP);
  const barrel = new Graphics().rect(0, -0.5, BARREL_LENGTH, 1).fill(hex(colors.secondary));
  const chargeDots = new Graphics();
  arm.addChild(barrel, chargeDots);
  hull.addChild(body, arm);
  const deadBarrel = new Graphics().rect(0, -0.5, BARREL_LENGTH - 1, 1).fill(WRECK_GREY);
  deadBarrel.position.set(0, -BARREL_BASE_UP + 2);
  const rotating = new Container();
  rotating.addChild(hull, tread, deadBarrel);
  // 地形や車体の傾きに合わせない粒と HP バー
  const fx = new Graphics();
  const hpBar = new Graphics();
  world.addChild(rotating, fx, hpBar);

  const label = new Container();
  const text = new Text({
    text: nickname,
    style: { fontFamily: "DotGothic16, monospace", fontSize: 16, fill: team ?? colors.primary },
    resolution: 1,
  });
  text.anchor.set(0.5, 1);
  // 手番の機体に出す。名前と同じ色で、誰の番かを名前に結び付ける
  const caret = createTurnCaret(hex(team ?? colors.primary));
  label.addChild(text, caret);
  let caretElapsed = 0, clock = 0, reduced = false;
  const moments: Moments = { first: true, hp: 0, deathAt: null, falling: false, landAt: null };
  let hullKey = "", distance = 0, previousX: number | null = null, lastPose: TankPose | null = null;

  /** 撃破の途中なら壊れる前の姿で描く。撃破の瞬間を見ていない（再接続など）ならすぐ残骸 */
  const wreckState = (pose: TankPose) => {
    const frame = moments.deathAt === null ? null : wreckFrameAt(clock - moments.deathAt, reduced);
    return { frame, wrecked: pose.hp <= 0 && (frame === null || !frame.intact) };
  };

  const drawFx = (pose: TankPose, frame: ReturnType<typeof wreckFrameAt> | null, wrecked: boolean): number => {
    fx.clear();
    const landing = moments.landAt === null ? null : landingAt(clock - moments.landAt, reduced);
    if (landing) drawDust(fx, landing.dust);
    if (!wrecked && pose.hp > 0 && pose.hp <= LOW_HP) drawLowHpSmoke(fx, clock, reduced);
    if (frame) drawBursts(fx, frame.bursts);
    if (frame?.smoke && moments.deathAt !== null) drawWreckSmoke(fx, clock - moments.deathAt - WRECK_SMOKE_FROM_MS);
    return landing?.squash ?? 0;
  };

  const drawCharge = (pose: TankPose, wrecked: boolean): number => {
    chargeDots.clear();
    const charge = pose.aiming && !wrecked ? chargeAt(pose.charge ?? 0, clock, reduced) : null;
    if (!charge) return 0;
    for (const d of charge.dots) chargeDots.rect(BARREL_LENGTH + d.x, d.y - 0.25, 0.5, 0.5);
    chargeDots.fill(charge.hot ? CHARGE_HOT_COLOR : CHARGE_COLOR);
    return charge.shake;
  };

  const render = (): void => {
    const pose = lastPose;
    if (!pose) return;
    const { frame, wrecked } = wreckState(pose);
    const white = pose.flash || frame?.white === true;
    const key = `${wrecked}/${white}`;
    if (key !== hullKey) {
      hullKey = key;
      if (wrecked) drawTankWreck(body);
      else drawHull(body, colors, white);
    }
    arm.visible = !wrecked;
    tread.visible = !wrecked;
    deadBarrel.visible = wrecked;
    deadBarrel.rotation = -(pose.facing === 1 ? -WRECK_DROOP : 180 + WRECK_DROOP) * DEG;
    text.style.fill = wrecked ? 0x929b96 : team ?? colors.primary;
    hpBar.visible = showHealth && !wrecked;
    caret.visible = pose.acting === true && !wrecked;
    const squash = drawFx(pose, frame, wrecked);
    const rumble = pose.acting === true && !wrecked && !pose.falling ? idleRumble(clock, reduced) : 0;
    hull.y = (rumble + squash) * ART;
    const local = pose.facing === 1 ? pose.elevation : 180 - pose.elevation;
    arm.rotation = -(local + drawCharge(pose, wrecked)) * DEG;
  };

  const setPose = (pose: TankPose, cell: number): void => {
    noteMoments(moments, pose, clock);
    world.visible = pose.visible;
    label.visible = pose.visible;
    world.position.set(pose.x + 0.5, pose.y);
    rotating.rotation = -pose.tilt * DEG;
    const signedDelta = previousX === null ? 0 : pose.x - previousX;
    const delta = Math.abs(signedDelta);
    previousX = pose.x;
    const moving = pose.hp > 0 && pose.visible && !pose.falling && delta > .001 && delta <= 2.5;
    if (moving) { distance += signedDelta; drawTread(tread, distance); playSound("move"); }
    drawHpBar(hpBar, { ...colors, primary: team ?? colors.primary }, pose);
    lastPose = pose;
    render();
    label.position.set((pose.x + 0.5) * cell, (pose.y - 12) * cell);
  };

  return {
    world,
    label,
    setPose,
    tick: (deltaMs, reducedMotion) => {
      clock += deltaMs;
      reduced = reducedMotion;
      caretElapsed = caret.visible ? caretElapsed + deltaMs : 0;
      placeTurnCaret(caret, caretElapsed, reducedMotion);
      render();
    },
    destroy: () => {
      world.destroy({ children: true });
      label.destroy({ children: true });
    },
  };
};
