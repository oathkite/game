import { simulateShot } from "@game/sim";
import type { MatchView } from "@/match/types";

// e2e と開発時の確認用。現在の盤面で相手にダメージが入る照準を探す。ゲームの UI からは使わない。

export type Aim = {
  readonly elevation: number;
  readonly power: number;
};

// パワーの探索上限。100 に達すると自動で発射されるので（設計書 03 の 3.5）、
// 押している時間で作る e2e が待ち時間の誤差でしきい値を跨がないよう余裕を取る
const POWER_SEARCH_MAX = 90;

/** パワーが前後 tolerance ずれても相手にダメージが入る照準。見つからなければ null */
export const findRobustAim = (view: MatchView, tolerance = 2): Aim | null => {
  const c = view.control;
  if (!view.mask || !view.players || !c || view.mySeat === null) return null;
  const me = view.mySeat;
  const opp = me === 0 ? 1 : 0;
  const [p0, p1] = view.players;
  const players = [{ x: p0.x, hp: p0.hp }, { x: p1.x, hp: p1.hp }] as const;
  const damageOf = (elevation: number, power: number): number => {
    const input = { seat: me, x: c.x, facing: c.facing, elevation, power, wind: view.wind.value };
    const r = simulateShot(view.mask as NonNullable<MatchView["mask"]>, players, input).result;
    return r.damage[opp] - r.damage[me];
  };
  let best: (Aim & { readonly score: number }) | null = null;
  // 粗く探す。e2e で 1 ターンあたり数秒に収めるため
  for (let elevation = 20; elevation <= 75; elevation += 3) {
    for (let power = 30; power <= POWER_SEARCH_MAX - tolerance; power += 2) {
      let score = Number.POSITIVE_INFINITY;
      for (const d of [-tolerance, 0, tolerance]) score = Math.min(score, damageOf(elevation, power + d));
      if (score > 0 && (best === null || score > best.score)) best = { elevation, power, score };
    }
  }
  return best ? { elevation: best.elevation, power: best.power } : null;
};
