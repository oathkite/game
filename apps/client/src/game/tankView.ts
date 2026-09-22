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

type Parts = {
  readonly world: Container; readonly rotating: Container; readonly hull: Container; readonly body: Graphics; readonly tread: Graphics;
  readonly arm: Container; readonly chargeDots: Graphics; readonly deadBarrel: Graphics; readonly fx: Graphics; readonly hpBar: Graphics;
  readonly label: Container; readonly text: Text; readonly caret: Graphics;
};

/** 表示物を組み立てる。座標はセルで、名前とキャレットだけは拡大しない層に置く */
const buildParts = (colors: Colors, nickname: string, nameColor: string): Parts => {
  const world = new Container(), hull = new Container(), body = new Graphics(), tread = new Graphics();
  drawHull(body, colors, false);
  drawTread(tread, 0);
  // 主砲。1 セル幅で長さは物理の主砲（4 セル）に揃える。溜めの点は砲身と一緒に回す
  const arm = new Container();
  arm.position.set(0, -BARREL_BASE_UP);
  const chargeDots = new Graphics();
  arm.addChild(new Graphics().rect(0, -0.5, BARREL_LENGTH, 1).fill(hex(colors.secondary)), chargeDots);
  hull.addChild(body, arm);
  const deadBarrel = new Graphics().rect(0, -0.5, BARREL_LENGTH - 1, 1).fill(WRECK_GREY);
  deadBarrel.position.set(0, -BARREL_BASE_UP + 2);
  const rotating = new Container();
  rotating.addChild(hull, tread, deadBarrel);
  // 地形や車体の傾きに合わせない粒と HP バー
  const fx = new Graphics(), hpBar = new Graphics();
  world.addChild(rotating, fx, hpBar);
  const label = new Container();
  const text = new Text({ text: nickname, style: { fontFamily: "DotGothic16, monospace", fontSize: 16, fill: nameColor }, resolution: 1 });
  text.anchor.set(0.5, 1);
  // 手番の機体に出す。名前と同じ色で、誰の番かを名前に結び付ける
  const caret = createTurnCaret(hex(nameColor));
  label.addChild(text, caret);
  return { world, rotating, hull, body, tread, arm, chargeDots, deadBarrel, fx, hpBar, label, text, caret };
};

/** 描画に使う時刻と設定。clock は tick で進める自前の時計 */
type Frame = { readonly pose: TankPose; readonly clock: number; readonly reduced: boolean; readonly moments: Moments };

/** 撃破の途中なら壊れる前の姿で描く。撃破の瞬間を見ていない（再接続など）ならすぐ残骸 */
const wreckState = ({ pose, clock, reduced, moments }: Frame) => {
  const frame = moments.deathAt === null ? null : wreckFrameAt(clock - moments.deathAt, reduced);
  return { frame, wrecked: pose.hp <= 0 && (frame === null || !frame.intact) };
};

/** 接地点の周りの粒。着地の沈み込みの量を返す */
const drawFx = (fx: Graphics, f: Frame, wreck: ReturnType<typeof wreckState>): number => {
  const { pose, clock, reduced, moments } = f;
  fx.clear();
  const landing = moments.landAt === null ? null : landingAt(clock - moments.landAt, reduced);
  if (landing) drawDust(fx, landing.dust);
  if (!wreck.wrecked && pose.hp > 0 && pose.hp <= LOW_HP) drawLowHpSmoke(fx, clock, reduced);
  if (wreck.frame) drawBursts(fx, wreck.frame.bursts);
  if (wreck.frame?.smoke && moments.deathAt !== null) drawWreckSmoke(fx, clock - moments.deathAt - WRECK_SMOKE_FROM_MS);
  return landing?.squash ?? 0;
};

/** 砲口に集まる溜めの点。砲身の震え（度）を返す */
const drawCharge = (g: Graphics, f: Frame, wrecked: boolean): number => {
  g.clear();
  const charge = f.pose.aiming && !wrecked ? chargeAt(f.pose.charge ?? 0, f.clock, f.reduced) : null;
  if (!charge) return 0;
  for (const d of charge.dots) g.rect(BARREL_LENGTH + d.x, d.y - 0.25, 0.5, 0.5);
  g.fill(charge.hot ? CHARGE_HOT_COLOR : CHARGE_COLOR);
  return charge.shake;
};

/** 1 フレームぶんを描く。車体の絵は姿が変わったときだけ描き直し、描いた姿の鍵を返す */
const renderTank = (parts: Parts, f: Frame, colors: Colors, nameColor: string, showHealth: boolean, hullKey: string): string => {
  const { pose } = f;
  const wreck = wreckState(f);
  const key = `${wreck.wrecked}/${pose.flash || wreck.frame?.white === true}`;
  if (key !== hullKey) {
    if (wreck.wrecked) drawTankWreck(parts.body);
    else drawHull(parts.body, colors, pose.flash || wreck.frame?.white === true);
  }
  parts.arm.visible = !wreck.wrecked;
  parts.tread.visible = !wreck.wrecked;
  parts.deadBarrel.visible = wreck.wrecked;
  parts.deadBarrel.rotation = -(pose.facing === 1 ? -WRECK_DROOP : 180 + WRECK_DROOP) * DEG;
  parts.text.style.fill = wreck.wrecked ? 0x929b96 : nameColor;
  parts.hpBar.visible = showHealth && !wreck.wrecked;
  parts.caret.visible = pose.acting === true && !wreck.wrecked;
  const squash = drawFx(parts.fx, f, wreck);
  const rumble = pose.acting === true && !wreck.wrecked && !pose.falling ? idleRumble(f.clock, f.reduced) : 0;
  parts.hull.y = (rumble + squash) * ART;
  const local = pose.facing === 1 ? pose.elevation : 180 - pose.elevation;
  parts.arm.rotation = -(local + drawCharge(parts.chargeDots, f, wreck.wrecked)) * DEG;
  return key;
};

export const createTankView = (selection: TankColors, nickname: string, team?: string, showHealth = true): TankView => {
  const colors = { primary: COLOR_HEX[selection.primary], secondary: COLOR_HEX[selection.secondary] };
  const nameColor = team ?? colors.primary;
  const parts = buildParts(colors, nickname, nameColor);
  const moments: Moments = { first: true, hp: 0, deathAt: null, falling: false, landAt: null };
  let caretElapsed = 0, clock = 0, reduced = false, hullKey = "", distance = 0, previousX: number | null = null;
  let lastPose: TankPose | null = null, rendered = false;
  const render = (): void => {
    if (lastPose) hullKey = renderTank(parts, { pose: lastPose, clock, reduced, moments }, colors, nameColor, showHealth, hullKey);
  };
  const setPose = (pose: TankPose, cell: number): void => {
    noteMoments(moments, pose, clock);
    parts.world.visible = pose.visible;
    parts.label.visible = pose.visible;
    parts.world.position.set(pose.x + 0.5, pose.y);
    parts.rotating.rotation = -pose.tilt * DEG;
    const signedDelta = previousX === null ? 0 : pose.x - previousX;
    previousX = pose.x;
    if (pose.hp > 0 && pose.visible && !pose.falling && Math.abs(signedDelta) > .001 && Math.abs(signedDelta) <= 2.5) { distance += signedDelta; drawTread(parts.tread, distance); playSound("move"); }
    drawHpBar(parts.hpBar, { ...colors, primary: nameColor }, pose);
    lastPose = pose;
    render();
    rendered = true;
    parts.label.position.set((pose.x + 0.5) * cell, (pose.y - 12) * cell);
  };
  // 姿勢が毎フレーム届くあいだは setPose が描き、届かないフレームだけ tick が描く
  const tick = (deltaMs: number, reducedMotion: boolean): void => {
    clock += deltaMs;
    reduced = reducedMotion;
    caretElapsed = parts.caret.visible ? caretElapsed + deltaMs : 0;
    placeTurnCaret(parts.caret, caretElapsed, reducedMotion);
    if (!rendered) render();
    rendered = false;
  };
  const destroy = (): void => {
    parts.world.destroy({ children: true });
    parts.label.destroy({ children: true });
  };
  return { world: parts.world, label: parts.label, setPose, tick, destroy };
};
