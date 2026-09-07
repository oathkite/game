import type { WeaponId } from "@game/protocol";
import { weaponSpec, type StageSpec } from "@game/sim";
import { CARVE_AT_MS, FAN_DELAY_MS, HOLD_MS, IMPACT_TOTAL_MS, VOLLEY_DELAY_MS, blastFrameAt } from "@/game/hitFeedback";
import { bulletSize, trailStep, type BulletSize } from "@/game/weaponArt";

// 設定画面の武器デモ。設計書 09 の 9.2。武器を選ぶと、プレビューの戦車がその武器を 1 発撃つ。
// プレビューは対戦と同じ倍率のマップの切れ端で、単位は対戦と同じセル。時間は秒。
// 見た目だけの弾道で、sim の物理とは別物。浮動小数点を使ってよい（判定に使わないため）。
// 武器ごとの差（扇、時間差の発、初速、重力、着弾の段、弾の大きさ、尾）は sim の数値と weaponArt から引き、
// 着弾の演出（静止、膨張、削り、明滅、消失、破片）は対戦の再生と同じ hitFeedback の時間割を使う（設計書 03 の 3.9）。
// 武器ごとに変わらない値は prepareDemo で 1 回だけ用意し、フレームごとには t を進めるだけにする。

/** 地面の厚み（セル）。掘削弾の爆風（半径 16）と貫通弾の 3 段が収まる */
export const GROUND_ROWS = 20;
/** 戦車の左端のセル */
export const TANK_X = 4;
/** 戦車の絵の高さと、主砲の先端の付け根からの高さ（セル）。TankPreview の絵と合わせる */
const TANK_ROWS = 5;
const BARREL_CELLS = 4;
/** 標準砲が落ちる位置。主砲の先端から右端までの距離に対する割合。レーザー弾（重力 70%、到達距離 1 / 0.7 倍）でも右端の内側に落ちる値 */
const RANGE_SHARE = 0.6;
/** 重力（セル/秒^2）。初速は幅から決めるので、これが飛ぶ時間を決める */
const GRAVITY = 200;
/** 発射角（度） */
const LAUNCH_DEG = 45;
/** 尾を残す 1 段あたりの時間（秒）と本数 */
const TRAIL_UNIT_SEC = 0.04;
const TRAIL_COUNT = 10;
/** 破片が飛ぶ時間（秒）と初速（セル/秒）。設計書 03 の 3.9 の表 */
const DEBRIS_SEC = 0.4;
const DEBRIS_SPEED = 40;
/** 貫通の次の段を探す刻み（秒）と上限（秒） */
const STAGE_SEARCH_STEP = 0.002;
const STAGE_SEARCH_MAX = 1;

const HOLD_SEC = HOLD_MS / 1000;
const CARVE_SEC = CARVE_AT_MS / 1000;
const IMPACT_TOTAL_SEC = IMPACT_TOTAL_MS / 1000;

type Point = { readonly x: number; readonly y: number };

/** 切れ端の大きさと、戦車と主砲の先端の位置。単位はセル、y は下向きが正 */
export type Field = {
  readonly cols: number;
  readonly rows: number;
  /** 地面の上端の行。戦車はこの上に載る */
  readonly ground: number;
  /** 戦車の絵の左上 */
  readonly tank: Point;
  /** 主砲の先端。弾はここから出る */
  readonly muzzle: Point;
};

/** 幅（セル）から切れ端を決める。高さは最も高く飛ぶレーザー弾の頂点が収まる分だけ取る */
export const fieldFor = (cols: number): Field => {
  // 到達距離 R の 45 度の弾の頂点は R / 4。レーザー弾は重力 70% で R も頂点も 1 / 0.7 倍になる
  const apex = Math.ceil((RANGE_SHARE * cols) / 4 / 0.7);
  const rows = apex + TANK_ROWS + BARREL_CELLS + GROUND_ROWS + 4;
  const ground = rows - GROUND_ROWS;
  const tank = { x: TANK_X, y: ground - TANK_ROWS };
  return { cols, rows, ground, tank, muzzle: { x: tank.x + 4 + BARREL_CELLS + 1, y: tank.y - BARREL_CELLS + 0.5 } };
};

/** 弾道を決める値 */
export type Flight = { readonly vx: number; readonly vy: number; readonly gravity: number };

/** 着弾の 1 段。at は発射からの秒（前の段で止まる時間を含む）、flightAt は弾道上の時刻 */
export type Stage = Point & { readonly at: number; readonly flightAt: number; readonly radius: number };

export type Shot = {
  /** 発射の遅れ（秒）。扇の 2 本目以降と時間差の次の発は遅れて出る */
  readonly delay: number;
  readonly flight: Flight;
  /** 着弾の段。右端から出た外れなら空 */
  readonly stages: readonly Stage[];
};

export type Demo = {
  readonly field: Field;
  readonly shots: readonly Shot[];
  readonly size: BulletSize;
  /** 尾の間隔（ステップ）。0 なら残さない */
  readonly trail: number;
};

export type Blast = Point & { readonly radius: number; readonly ring: boolean };
export type Crater = Point & { readonly radius: number };

export type DemoFrame = {
  readonly bullets: readonly (Point & BulletSize)[];
  readonly trails: readonly Point[];
  /** 爆風。明滅の消灯側は含めない */
  readonly blasts: readonly Blast[];
  /** 削れた地形。着弾の順 */
  readonly craters: readonly Crater[];
  /** 破片。1 セルの正方形 */
  readonly debris: readonly Point[];
  readonly done: boolean;
};

/** 弾道上の時刻 t での位置 */
const positionAt = (field: Field, f: Flight, t: number): Point => ({
  x: field.muzzle.x + f.vx * t,
  y: field.muzzle.y - f.vy * t + (f.gravity * t * t) / 2,
});

/** 地面か右端に届く時刻。二分法で求める */
export const landingTime = (field: Field, f: Flight): number => {
  const out = (t: number): boolean => {
    const p = positionAt(field, f, t);
    return p.y >= field.ground || p.x >= field.cols;
  };
  let lo = 0;
  let hi = 1;
  while (!out(hi)) hi *= 2;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (out(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
};

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** 前の段の爆風の穴を抜けて次に地形へ当たる時刻。穴の縁までの距離が半径に達した時点とする */
const nextStageTime = (field: Field, f: Flight, prev: Stage): number => {
  for (let t = prev.flightAt + STAGE_SEARCH_STEP; t < prev.flightAt + STAGE_SEARCH_MAX; t += STAGE_SEARCH_STEP) {
    if (distance(positionAt(field, f, t), prev) >= prev.radius) return t;
  }
  return prev.flightAt + STAGE_SEARCH_MAX;
};

/** 着弾の段を並べる。1 段目は地面、以降は前の段の穴を抜けた先。各段の前で HOLD_MS ずつ止まるぶんを at に足す */
const stagesOf = (field: Field, f: Flight, specs: readonly StageSpec[]): readonly Stage[] => {
  const first = landingTime(field, f);
  if (positionAt(field, f, first).x >= field.cols) return [];
  return specs.reduce<Stage[]>((acc, spec, k) => {
    const prev = acc[k - 1];
    const flightAt = prev ? nextStageTime(field, f, prev) : first;
    return [...acc, { ...positionAt(field, f, flightAt), at: flightAt + k * HOLD_SEC, flightAt, radius: spec.blastRadius }];
  }, []);
};

/** 武器の弾道を並べる。扇の本数 × 時間差の発数。標準砲の初速は、先端から右端までの RANGE_SHARE に落ちる値から決める */
export const demoShots = (weapon: WeaponId, field: Field): readonly Shot[] => {
  const spec = weaponSpec(weapon);
  const gravity = (GRAVITY * spec.gravityPercent) / 100;
  const base = Math.sqrt(GRAVITY * RANGE_SHARE * (field.cols - field.muzzle.x));
  return Array.from({ length: spec.volleys }, (_, v) =>
    spec.fan.map((fan, i) => {
      const speed = (base * spec.speedPercent * fan.speedPercent) / 10000;
      const rad = ((LAUNCH_DEG + fan.deg) * Math.PI) / 180;
      const flight = { vx: speed * Math.cos(rad), vy: speed * Math.sin(rad), gravity };
      return { delay: (v * VOLLEY_DELAY_MS + i * FAN_DELAY_MS) / 1000, flight, stages: stagesOf(field, flight, spec.stages) };
    }),
  ).flat();
};

/** 武器ごとに変わらない値をまとめる。デモを撃ち始めるときに 1 回だけ呼ぶ */
export const prepareDemo = (weapon: WeaponId, field: Field): Demo => ({
  field,
  shots: demoShots(weapon, field),
  size: bulletSize(weapon),
  trail: trailStep(weapon),
});

/** 弾道上の現在の時刻と、着弾点で止まっているか。t は発射からの秒。飛び終えたら null */
export const bulletTimeAt = (shot: Shot, t: number): { readonly flightAt: number; readonly holding: boolean } | null => {
  const last = shot.stages[shot.stages.length - 1];
  if (last && t >= last.at + HOLD_SEC) return null;
  const passed = shot.stages.filter((s) => t >= s.at);
  const current = passed[passed.length - 1];
  if (current && t < current.at + HOLD_SEC) return { flightAt: current.flightAt, holding: true };
  return { flightAt: t - passed.length * HOLD_SEC, holding: false };
};

/** 尾。飛んでいる間の過去の位置。1 段の間隔は武器の尾の間隔に比例させる */
const trailsOf = (field: Field, f: Flight, flightAt: number, step: number): readonly Point[] =>
  step === 0
    ? []
    : Array.from({ length: TRAIL_COUNT }, (_, k) => flightAt - (k + 1) * step * TRAIL_UNIT_SEC)
        .filter((past) => past >= 0)
        .map((past) => positionAt(field, f, past));

/** 破片の数。設計書 03 の 3.9 の表 */
export const debrisCount = (radius: number): number => (radius >= 10 ? 8 : radius >= 6 ? 6 : radius >= 3 ? 4 : 2);

/** 削れた時点から e 秒後の破片。爆心から上へ寄せた決まった向きに飛び、重さで落ちる。格子に揃える */
const debrisOf = (stage: Stage, e: number): readonly Point[] =>
  Array.from({ length: debrisCount(stage.radius) }, (_, i) => {
    const deg = 30 + (120 * (i + 0.5)) / debrisCount(stage.radius);
    const rad = (deg * Math.PI) / 180;
    return {
      x: Math.floor(stage.x + DEBRIS_SPEED * Math.cos(rad) * e),
      y: Math.floor(stage.y - DEBRIS_SPEED * Math.sin(rad) * e + (GRAVITY * e * e) / 2),
    };
  });

/** 経過 t 秒のフレーム。全弾の着弾の演出が消えたら done */
export const demoFrame = (demo: Demo, t: number): DemoFrame => {
  const { field } = demo;
  const live = demo.shots.filter((s) => t >= s.delay).map((s) => ({ shot: s, local: t - s.delay }));
  const flying = live.flatMap(({ shot, local }) => {
    const b = bulletTimeAt(shot, local);
    return b ? [{ shot, ...b }] : [];
  });
  const stages = live.flatMap(({ shot, local }) => shot.stages.map((stage) => ({ stage, e: local - stage.at })));
  const blasts = stages.flatMap(({ stage, e }) => {
    const bf = e >= 0 ? blastFrameAt(e * 1000, stage.radius) : null;
    return bf && bf.radius > 0 && bf.on ? [{ x: stage.x, y: stage.y, radius: bf.radius, ring: bf.ring }] : [];
  });
  const carved = stages.filter(({ e }) => e >= CARVE_SEC);
  return {
    bullets: flying.map(({ shot, flightAt }) => ({ ...positionAt(field, shot.flight, flightAt), ...demo.size })),
    trails: flying.filter((b) => !b.holding).flatMap(({ shot, flightAt }) => trailsOf(field, shot.flight, flightAt, demo.trail)),
    blasts,
    craters: carved.map(({ stage }) => ({ x: stage.x, y: stage.y, radius: stage.radius })),
    debris: carved.filter(({ e }) => e - CARVE_SEC < DEBRIS_SEC).flatMap(({ stage, e }) => debrisOf(stage, e - CARVE_SEC)),
    done: demo.shots.every((s) => {
      const last = s.stages[s.stages.length - 1];
      return t - s.delay >= (last ? last.at + IMPACT_TOTAL_SEC : landingTime(field, s.flight));
    }),
  };
};
