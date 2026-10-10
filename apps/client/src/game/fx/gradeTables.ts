import { PALETTE } from "../palette";

// 色の寄せの置き換え表。設計書 41.13 の評価と改善（2 回目）。
// 暗転と空の色の寄せを、乗算ではなく「パレットの色をパレットの別の色へ置き換える」表で行う。
// 乗算では赤の成分を上げられず、橙や赤に寄せられなかった（掘削弾の空が灰色、撃破の空が紫になった）。置き換えなら描く画素はパレットの色のままになる。

export type GradeTable = ReadonlyMap<number, number>;

/** 寄せの優先度。効いている寄せが重なったら、高いほうを当てる（screenFx.ts） */
export const TINT_PRIORITY = { weapon: 0, kill: 1 } as const;
export type TintPriority = (typeof TINT_PRIORITY)[keyof typeof TINT_PRIORITY];

const P = PALETTE;

/** 1 段ずつ暗くする並び。各並びの最後の色は、さらに暗い色へ送る */
const RAMPS: readonly (readonly number[])[] = [
  [P.sky4, P.sky3, P.sky2, P.sky1, P.sky0, P.black],
  [P.white, P.starDim, P.starFaint, P.sky3],
  [P.moon, P.moonShade, P.stone1],
  [P.greenPale, P.greenLight, P.green, P.greenMid, P.greenDark, P.greenDeep, P.greenBlack, P.black],
  [P.loam0, P.loam1, P.loam2, P.loam3, P.black],
  [P.stone0, P.stone1, P.stone2, P.stone3, P.black],
  [P.ochre0, P.ochre1, P.ochre2, P.loam3],
  [P.violet0, P.violet1, P.violet2, P.sky0],
  [P.fire1, P.fire2, P.fire3, P.fire4, P.fire5, P.fire6, P.loam3],
  [P.smoke0, P.smoke1, P.smoke2, P.smoke3, P.black],
  [P.metal0, P.metal1, P.metal2, P.metal3, P.black],
  [P.energy0, P.energy1, P.energy2, P.sky4],
  [P.outline, P.black],
];

/** 暗転。各色を 1 段暗いパレットの色へ */
export const DIM_TABLE: GradeTable = new Map(RAMPS.flatMap(ramp => ramp.slice(0, -1).map((c, i) => [c, ramp[i + 1]!] as const)));

/** 空と遠景の色（夜空の帯、山並み、木々、淡い星） */
const skyTable = (to: Readonly<Record<"sky0" | "sky1" | "sky2" | "sky3" | "sky4" | "violet0" | "violet1" | "violet2" | "starFaint", number>>): GradeTable =>
  new Map((Object.keys(to) as (keyof typeof to)[]).map(key => [P[key], to[key]] as const));

/** 掘削弾。空を黄土と焦げ茶へ寄せる。近い山並み（sky1）は地面より 1 段暗い焦げ茶にして、地面と見分ける（評価の 3 回目） */
export const WARM_TABLE: GradeTable = skyTable({ sky0: P.loam3, sky1: P.loam3, sky2: P.loam2, sky3: P.ochre2, sky4: P.ochre1, violet0: P.ochre1, violet1: P.ochre2, violet2: P.loam3, starFaint: P.ochre1 });
/** レーザー弾。空を淡い青灰へ短く寄せる */
export const LASER_TABLE: GradeTable = skyTable({ sky0: P.sky1, sky1: P.sky2, sky2: P.sky4, sky3: P.stone2, sky4: P.stone1, violet0: P.stone1, violet1: P.sky4, violet2: P.sky3, starFaint: P.stone1 });
/** テレポート。空を深い青へ長めに寄せる（もとは浮遊弾の表。浮遊弾を跳ね弾に作り替えたのでテレポートだけが使う） */
export const TELEPORT_TABLE: GradeTable = skyTable({ sky0: P.sky1, sky1: P.sky3, sky2: P.sky4, sky3: P.sky4, sky4: P.stone2, violet0: P.stone2, violet1: P.sky4, violet2: P.sky3, starFaint: P.energy2 });
/** 撃破。空を深い赤へ。赤は撃破だけに使う（ダメージ段階 3 は暗転だけにした。直撃のたびに赤くなると撃破との差が薄れた） */
export const KILL_TABLE: GradeTable = skyTable({ sky0: P.loam3, sky1: P.fire6, sky2: P.fire6, sky3: P.fire5, sky4: P.fire5, violet0: P.fire5, violet1: P.fire6, violet2: P.fire6, starFaint: P.fire4 });

const luminance = (c: number): number => 0.2126 * ((c >> 16) & 0xff) + 0.7152 * ((c >> 8) & 0xff) + 0.0722 * (c & 0xff);

/** 表のうち、元の色が明るい半分だけ。色の寄せの入りと戻りの 1 段に使い、一段で点いて一段で消えるのを避ける */
export const brighterHalf = (table: GradeTable): GradeTable => {
  const entries = [...table.entries()].sort((a, b) => luminance(b[0]) - luminance(a[0]));
  return new Map(entries.slice(0, Math.ceil(entries.length / 2)));
};

/** 表を続けて当てる（先に a、次に b）。暗転と空の寄せが重なったときに使う */
export const composeTables = (a: GradeTable, b: GradeTable): GradeTable => {
  const out = new Map<number, number>();
  for (const color of new Set([...a.keys(), ...b.keys()])) {
    const first = a.get(color) ?? color, second = b.get(first) ?? first;
    if (second !== color) out.set(color, second);
  }
  return out;
};
