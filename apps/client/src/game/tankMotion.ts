// 機体まわりの演出の時間の流れ。設計書 38。描画は tankView.ts が行う。
// 単位はミリ秒とセル。車体の沈み込みだけは art px（1/8 セル）で返す。乱数は使わず、固定の表で散らす。

/** 手番の機体が 1 art px 沈む周期 */
export const RUMBLE_PERIOD_MS = 400;
/** 周期のうち沈んでいる長さ */
export const RUMBLE_DOWN_MS = 100;

/** 手番の機体のエンジン振動。沈む量（art px）。動きを減らす設定では止める */
export const idleRumble = (elapsedMs: number, reduced: boolean): 0 | 1 => {
  if (reduced || elapsedMs < 0) return 0;
  return elapsedMs % RUMBLE_PERIOD_MS < RUMBLE_DOWN_MS ? 1 : 0;
};

export type Dot = { readonly x: number; readonly y: number };

/** 着地の演出の長さ */
export const LAND_MS = 400;
/** 着地で車体が沈んでいる長さ */
export const LAND_SQUASH_MS = 120;
/** 土煙の粒の横の初速（セル/秒）。左右対称に 3 粒ずつ */
const DUST_SPEEDS: readonly number[] = [12, 20, 28];

export type Landing = {
  /** 車体の沈み込み（art px） */
  readonly squash: 0 | 1;
  /** 土煙の粒。接地点からの位置（セル） */
  readonly dust: readonly Dot[];
};

/** 着地から t ミリ秒後。過ぎたら null。動きを減らす設定では沈み込みだけ */
export const landingAt = (t: number, reduced: boolean): Landing | null => {
  if (t < 0 || t >= LAND_MS) return null;
  const squash = t < LAND_SQUASH_MS ? 1 : 0;
  if (reduced) return { squash, dust: [] };
  const sec = t / 1000;
  const rise = Math.trunc(Math.sin((t / LAND_MS) * Math.PI) * 2);
  const dust = DUST_SPEEDS.flatMap((speed, i) => {
    const x = 6 + Math.trunc(speed * sec);
    const y = -1 - rise - (i % 2);
    return [{ x: -x, y }, { x, y }];
  });
  return { squash, dust };
};

/** 煙を出し始める HP。これ以下で撃破が近いと見せる */
export const LOW_HP = 30;
/** 煙の粒が立ちのぼって消える周期 */
export const SMOKE_PERIOD_MS = 2400;
/** 煙の粒の数 */
export const SMOKE_PUFFS = 5;
/** 煙が昇る高さ（セル） */
const SMOKE_RISE = 8;
/** 粒ごとの横の揺れ（セル） */
const SMOKE_SWAY: readonly number[] = [0, 1, -1, 1, 0];

export type Puff = Dot & {
  /** 0 が濃く、2 が薄い */
  readonly tone: 0 | 1 | 2;
};

const puffAt = (phase: number, index: number): Puff => ({
  x: Math.trunc((SMOKE_SWAY[index % SMOKE_SWAY.length] ?? 0) * phase * 2 + phase * 2),
  y: -Math.trunc(phase * SMOKE_RISE),
  tone: phase < 0.35 ? 0 : phase < 0.7 ? 1 : 2,
});

/** 経過時間に対する煙の粒。発生点（砲塔の上）からの位置。動きを減らす設定では止まった 1 粒 */
export const smokeAt = (elapsedMs: number, reduced: boolean, count: number = SMOKE_PUFFS): readonly Puff[] => {
  if (reduced) return [{ x: 0, y: -2, tone: 1 }];
  return Array.from({ length: count }, (_, i) => {
    const age = (Math.max(0, elapsedMs) + (i * SMOKE_PERIOD_MS) / count) % SMOKE_PERIOD_MS;
    return puffAt(age / SMOKE_PERIOD_MS, i);
  });
};

/** HP が少ない機体の火花。周期の頭の 80 ms だけ点く */
export const smokeSparkOn = (elapsedMs: number, reduced: boolean): boolean => !reduced && Math.max(0, elapsedMs) % 1200 < 80;

/** 撃破の明滅が終わる時刻 */
export const WRECK_BLINK_MS = 260;
/** 残骸に替わる時刻 */
export const WRECK_AT_MS = 560;
/** 撃破の爆発が消える時刻 */
export const WRECK_MS = 820;
/** 残骸の煙を出す区間 */
export const WRECK_SMOKE_FROM_MS = 700;
export const WRECK_SMOKE_UNTIL_MS = 3200;
/** 時間差の小爆発。接地点からの位置（セル）と始まる時刻 */
const WRECK_BURSTS: readonly (readonly [number, number, number])[] = [
  [-3, -4, 260],
  [3, -6, 400],
  [0, -3, 540],
];

export type Burst = Dot & {
  readonly radius: number;
  readonly ring: boolean;
  /** 0 が白、1 が黄、2 が橙 */
  readonly tone: 0 | 1 | 2;
};

export type WreckFrame = {
  /** 壊れる前の姿で描く */
  readonly intact: boolean;
  /** 白く描く */
  readonly white: boolean;
  readonly bursts: readonly Burst[];
  /** 残骸から煙を出す */
  readonly smoke: boolean;
};

const burstAt = (e: number, dx: number, dy: number): Burst | null => {
  if (e < 0 || e >= 260) return null;
  if (e < 120) return { x: dx, y: dy, radius: 1 + Math.floor(e / 40), ring: false, tone: e < 60 ? 0 : 1 };
  if (e < 200) return { x: dx, y: dy, radius: 4, ring: false, tone: Math.floor(e / 40) % 2 === 1 ? 2 : 1 };
  return { x: dx, y: dy, radius: 4, ring: true, tone: 2 };
};

/** 撃破から t ミリ秒後の見え方。動きを減らす設定では明滅も爆発も出さず、すぐ残骸にする */
export const wreckFrameAt = (t: number, reduced: boolean): WreckFrame => {
  if (reduced || t >= WRECK_MS) return { intact: false, white: false, bursts: [], smoke: !reduced && t >= WRECK_SMOKE_FROM_MS && t < WRECK_SMOKE_UNTIL_MS };
  const bursts = WRECK_BURSTS.flatMap(([dx, dy, at]) => {
    const b = burstAt(t - at, dx, dy);
    return b ? [b] : [];
  });
  return { intact: t < WRECK_AT_MS, white: t < WRECK_BLINK_MS && Math.floor(t / 50) % 2 === 0, bursts, smoke: false };
};

/** 砲身が震え始めるパワー（0〜1） */
export const CHARGE_SHAKE_FROM = 0.7;
/** 点が砲口へ集まる周期 */
const CHARGE_CYCLE_MS = 350;
/** 点が集まり始める距離（セル） */
const CHARGE_REACH = 4;

export type Charge = {
  /** 砲口からの点の位置（砲身の向きに沿った座標、セル） */
  readonly dots: readonly Dot[];
  /** 砲身の震え（度） */
  readonly shake: -1 | 0 | 1;
  /** 上限が近い */
  readonly hot: boolean;
};

/** パワーを溜めている間の砲口。charge は 0〜1。動きを減らす設定では点を止め、数だけで見せる */
export const chargeAt = (charge: number, elapsedMs: number, reduced: boolean): Charge | null => {
  if (charge <= 0) return null;
  const c = Math.min(1, charge);
  const hot = c >= CHARGE_SHAKE_FROM;
  const count = 1 + Math.min(4, Math.floor(c * 5));
  const dots = Array.from({ length: count }, (_, i) => {
    const phase = reduced ? 0.5 : ((Math.max(0, elapsedMs) + i * 70) % CHARGE_CYCLE_MS) / CHARGE_CYCLE_MS;
    const r = CHARGE_REACH * (1 - phase), a = i * 1.3;
    return { x: Math.trunc(Math.cos(a) * r * 2) / 2, y: Math.trunc(Math.sin(a) * r * 2) / 2 };
  });
  const shake = hot && !reduced ? (Math.floor(elapsedMs / 60) % 2 === 0 ? 1 : -1) : 0;
  return { dots, shake, hot };
};
