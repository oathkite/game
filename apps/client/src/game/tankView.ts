import { createTurnCaret, placeTurnCaret } from "./turnCaret";
import { playSound } from "@/app/audio";
import type { ShotFlash } from "./muzzlePose";
import { COLOR_HEX, frameSkinOf, turretSkinOf, type Facing, type FrameSkin, type TankColors, type TurretSkin, type WeaponId } from "@game/protocol";
import { Container, Graphics, Text } from "pixi.js";
import { antennaSwayAt, chargeAt, glideAfterStep, glideAfterTime, idleRumble, landingAt, LOW_HP, wreckFrameAt, WRECK_SMOKE_FROM_MS } from "./tankMotion";
import { drawBursts, drawDust, drawExhaust, drawLowHpSmoke, drawWreckSmoke } from "./tankFx";
import { TEAM_RAMPS, type Ramp } from "./palette";
import { ART_PER_CELL } from "./pixelGrid";
import { createPixelSprite, type PixelSprite } from "./pixelTexture";
import { chargeSparks, flashFrameAt } from "./tankFlash";
import { hpBarRects } from "./tankHpBar";
import { EXHAUST_PORTS } from "./frameSkins";
import { composeTank, TANK_FRAME, type TankSpriteInput } from "./tankSprite";

// 機体のスプライトを姿勢から描き直し、1 枚の texture として置く。設計書 40.5。
// 車体の傾きと砲身の角度は Container を回さず、tankSprite.ts が画素ごとに描き直して art px の格子に揃える。
// 位置はセルで、親のコンテナで拡大する。名前とキャレットは拡大しない層に置く。
// 手番の振動、着地、HP が少ないときの煙、撃破、パワーの溜めの時間は設計書 38。時間は tick で進める自前の時計で測る。

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
  /** 被弾で押し戻された横のずれ（art px）。爆心から遠ざかる向きが正の向き（設計書 41 の段階 4） */
  readonly nudge?: number;
  /** 砲身に描く武器（設計書 10.5、43） */
  readonly weapon: WeaponId;
  /** 車体後部に描くもう一方の武器。null なら載せない */
  readonly sub: WeaponId | null;
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

const hex = (c: string): number => Number.parseInt(c.slice(1), 16);

/** 機体ごとに固定の見た目。色の段とスキン */
type Look = { readonly hull: Ramp; readonly turret: Ramp; readonly turretSkin: TurretSkin; readonly frame: FrameSkin };

/** 浮遊の噴射を揺らすコマの長さ（ms） */
const BEAT_MS = 90;

/** 状態の変わり目の時刻。setPose で記録し、tick の時計で経過を測る */
type Moments = { first: boolean; hp: number; deathAt: number | null; falling: boolean; landAt: number | null; recoil: number; flash: boolean; swayAt: number; swayAmp: number };

/** アンテナを揺らす最初の振れ（art px、機体の前が正）。発射は後ろへ、被弾は前へ、着地と動き出しは後ろへ */
const SWAY_FIRE = -3, SWAY_HIT = 2, SWAY_LAND = -2, SWAY_MOVE = -1;

const swing = (m: Moments, clock: number, amplitude: number): void => { m.swayAt = clock; m.swayAmp = amplitude; };

const noteMoments = (m: Moments, pose: TankPose, clock: number): void => {
  if (!m.first && m.hp > 0 && pose.hp <= 0) m.deathAt = clock;
  if (pose.hp > 0) m.deathAt = null;
  if (m.falling && !pose.falling && pose.hp > 0) { m.landAt = clock; swing(m, clock, SWAY_LAND); }
  if (!m.first && (pose.recoil ?? 0) > 0 && m.recoil <= 0) swing(m, clock, SWAY_FIRE);
  if (!m.first && pose.flash && !m.flash) swing(m, clock, SWAY_HIT);
  m.first = false;
  m.hp = pose.hp;
  m.falling = pose.falling === true;
  m.recoil = pose.recoil ?? 0;
  m.flash = pose.flash;
};

type Parts = {
  readonly world: Container; readonly body: PixelSprite; readonly fx: Graphics; readonly hpBar: Graphics;
  readonly label: Container; readonly text: Text; readonly caret: Graphics;
};

/** 表示物を組み立てる。座標はセルで、名前とキャレットだけは拡大しない層に置く */
const buildParts = (nickname: string, nameColor: string): Parts => {
  const world = new Container(), body = createPixelSprite(TANK_FRAME);
  // 地形や車体の傾きに合わせない粒と HP バー
  const fx = new Graphics(), hpBar = new Graphics();
  world.addChild(body.sprite, fx, hpBar);
  const label = new Container();
  const text = new Text({ text: nickname, style: { fontFamily: "DotGothic16, monospace", fontSize: 16, fill: nameColor }, resolution: 1 });
  text.anchor.set(0.5, 1);
  // 手番の機体に出す。名前と同じ色で、誰の番かを名前に結び付ける
  const caret = createTurnCaret(hex(nameColor));
  label.addChild(text, caret);
  return { world, body, fx, hpBar, label, text, caret };
};

/** 描画に使う時刻と設定。clock は tick で進める自前の時計 */
type Frame = { readonly pose: TankPose; readonly clock: number; readonly reduced: boolean; readonly moments: Moments };

/** 撃破の途中なら壊れる前の姿で描く。撃破の瞬間を見ていない（再接続など）ならすぐ残骸 */
const wreckState = ({ pose, clock, reduced, moments }: Frame) => {
  const frame = moments.deathAt === null ? null : wreckFrameAt(clock - moments.deathAt, reduced);
  return { frame, wrecked: pose.hp <= 0 && (frame === null || !frame.intact) };
};

/** 接地点の周りの粒。着地の沈み込みの量を返す */
const drawFx = (fx: Graphics, f: Frame, wreck: ReturnType<typeof wreckState>, frame: FrameSkin): number => {
  const { pose, clock, reduced, moments } = f;
  fx.clear();
  const landing = moments.landAt === null ? null : landingAt(clock - moments.landAt, reduced);
  if (landing) drawDust(fx, landing.dust);
  if (!wreck.wrecked && pose.hp > 0 && pose.hp <= LOW_HP) drawLowHpSmoke(fx, clock, reduced);
  // 何もしていない間も機体が生きて見えるよう、排気口から小さな煙（HP が少ない機体は煙を出しているので出さない）
  else if (!wreck.wrecked && pose.hp > 0 && pose.visible && !pose.falling && EXHAUST_PORTS[frame]) drawExhaust(fx, clock, pose.facing, reduced, EXHAUST_PORTS[frame]);
  if (wreck.frame) drawBursts(fx, wreck.frame.bursts);
  if (wreck.frame?.smoke && moments.deathAt !== null) drawWreckSmoke(fx, clock - moments.deathAt - WRECK_SMOKE_FROM_MS);
  return landing?.squash ?? 0;
};

/** 発射光のコマ。同時に撃った砲身のうち、いちばん新しい発射で決める */
const flashOf = (pose: TankPose, reduced: boolean): number | null => {
  const ages = (pose.shotFlashes ?? []).map(s => s.age);
  return ages.length === 0 ? null : flashFrameAt(Math.min(...ages), reduced);
};

/** 姿勢と時刻から、スプライトを描く引数を決める */
const spriteInput = (f: Frame, look: Look, distance: number, squash: number, wreck: ReturnType<typeof wreckState>): TankSpriteInput => {
  const { pose, clock, reduced } = f;
  const wrecked = wreck.wrecked;
  const charge = pose.aiming && !wrecked ? chargeAt(pose.charge ?? 0, clock, reduced) : null;
  const rumble = pose.acting === true && !wrecked && !pose.falling ? idleRumble(clock, reduced) : 0;
  return {
    ...look, weapon: pose.weapon, sub: pose.sub, facing: pose.facing, tilt: Math.round(pose.tilt),
    elevation: pose.elevation + (charge?.shake ?? 0),
    recoil: reduced || wrecked ? 0 : Math.max(0, Math.min(2, Math.round(pose.recoil ?? 0))),
    sink: rumble + squash, treadPhase: Math.floor(distance * ART_PER_CELL),
    white: pose.flash || wreck.frame?.white === true, wrecked,
    rim: charge ? (charge.hot ? "hot" : "charge") : "none",
    flash: wrecked ? null : flashOf(pose, reduced),
    sparks: charge ? chargeSparks(pose.charge ?? 0, clock, reduced) : [],
    antenna: wrecked ? 0 : antennaSwayAt(clock - f.moments.swayAt, f.moments.swayAmp, reduced),
    // 時刻のコマは浮遊の噴射だけが使う。ほかのフレームでは 0 にして、時刻で描き直さない
    beat: look.frame === "hover" && !reduced ? Math.floor(clock / BEAT_MS) : 0,
  };
};

/** 絵が変わったかを比べる鍵。色とスキンは機体ごとに固定なので含めない */
const spriteKey = (i: TankSpriteInput): string =>
  `${i.facing}|${i.tilt}|${i.elevation}|${i.recoil}|${i.sink}|${i.treadPhase}|${i.white}|${i.wrecked}|${i.rim}|${i.flash}|${i.antenna ?? 0}|${i.weapon}|${i.sub}|${i.beat ?? 0}|${i.sparks.map(s => `${s.u},${s.v},${s.color}`).join(";")}`;

const drawHpBar = (g: Graphics, fill: number, pose: TankPose): void => {
  g.clear();
  for (const r of hpBarRects(pose.hp, pose.hpGhost ?? pose.hp, pose.ghostOn === true, fill)) {
    g.rect(r.x / ART_PER_CELL, r.y / ART_PER_CELL, r.w / ART_PER_CELL, r.h / ART_PER_CELL).fill(r.color);
  }
};

/** 1 フレームぶんを描く。スプライトは絵が変わったときだけ描き直し、描いた絵の鍵を返す */
const renderTank = (parts: Parts, f: Frame, look: Look, nameColor: string, showHealth: boolean, distance: number, drawnKey: string): string => {
  const wreck = wreckState(f);
  const squash = drawFx(parts.fx, f, wreck, look.frame);
  const input = spriteInput(f, look, distance, squash, wreck);
  const key = spriteKey(input);
  if (key !== drawnKey) parts.body.draw(composeTank(input));
  parts.text.style.fill = wreck.wrecked ? 0x929b96 : nameColor;
  parts.hpBar.visible = showHealth && !wreck.wrecked;
  parts.caret.visible = f.pose.acting === true && !wreck.wrecked;
  return key;
};

/** 接地点（セルの中央）を art px の格子に丸める */
const snap = (cells: number): number => Math.round(cells * ART_PER_CELL) / ART_PER_CELL;

export const createTankView = (selection: TankColors, nickname: string, team?: string, showHealth = true): TankView => {
  const look: Look = {
    hull: TEAM_RAMPS[selection.primary], turret: TEAM_RAMPS[selection.secondary],
    // スキンを足す前の保存状態と古いクライアントには無く、後から足したスキンはこのクライアントが知らないので、既定のスキンで受ける
    turretSkin: turretSkinOf(selection.turret), frame: frameSkinOf(selection.frame),
  };
  const nameColor = team ?? COLOR_HEX[selection.primary];
  const parts = buildParts(nickname, nameColor);
  const moments: Moments = { first: true, hp: 0, deathAt: null, falling: false, landAt: null, recoil: 0, flash: false, swayAt: -Infinity, swayAmp: 0 };
  let moving = false;
  let caretElapsed = 0, clock = 0, reduced = false, drawnKey = "", distance = 0, previousX: number | null = null;
  // 描く位置の、実際の位置からの遅れ（セル）。1 セルずつの歩みを、足回りの動きと合わせて滑らかに見せる
  let glide = 0;
  let lastPose: TankPose | null = null, rendered = false;
  const render = (): void => {
    if (!lastPose) return;
    parts.world.position.set(snap(lastPose.x - glide + 0.5 + (lastPose.nudge ?? 0) / ART_PER_CELL), snap(lastPose.y));
    drawnKey = renderTank(parts, { pose: lastPose, clock, reduced, moments }, look, nameColor, showHealth, distance - glide, drawnKey);
  };
  const setPose = (pose: TankPose, cell: number): void => {
    noteMoments(moments, pose, clock);
    parts.world.visible = pose.visible;
    parts.label.visible = pose.visible;
    const signedDelta = previousX === null ? 0 : pose.x - previousX;
    previousX = pose.x;
    const steps = pose.hp > 0 && pose.visible && !pose.falling && Math.abs(signedDelta) > .001 && Math.abs(signedDelta) <= 2.5;
    if (steps) { distance += signedDelta; playSound(`move-${look.frame}`); }
    glide = steps ? glideAfterStep(glide, signedDelta, reduced) : Math.abs(signedDelta) > .001 ? 0 : glide;
    if (steps && !moving) swing(moments, clock, SWAY_MOVE);
    moving = steps;
    drawHpBar(parts.hpBar, hex(nameColor), pose);
    lastPose = pose;
    render();
    rendered = true;
    parts.label.position.set((pose.x - glide + 0.5) * cell, (pose.y - 12) * cell);
  };
  // 姿勢が毎フレーム届くあいだは setPose が描き、届かないフレームだけ tick が描く
  const tick = (deltaMs: number, reducedMotion: boolean): void => {
    clock += deltaMs;
    reduced = reducedMotion;
    const gliding = glide !== 0;
    glide = reducedMotion ? 0 : glideAfterTime(glide, deltaMs);
    caretElapsed = parts.caret.visible ? caretElapsed + deltaMs : 0;
    placeTurnCaret(parts.caret, caretElapsed, reducedMotion);
    if (!rendered || gliding) render();
    rendered = false;
  };
  const destroy = (): void => {
    parts.world.destroy({ children: true });
    parts.body.destroy();
    parts.label.destroy({ children: true });
  };
  return { world: parts.world, label: parts.label, setPose, tick, destroy };
};
