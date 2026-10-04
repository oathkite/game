import type { CpuLevel } from "./cpuLevel";
import type { EngineState } from "@game/engine";
import type { ClientMessageOf } from "@game/protocol";
import { simulateShot } from "@game/sim";

export type CpuShot = ClientMessageOf<"turn.fire">;
/** 誤差を加える前の最善手。damage は相手へのダメージ、miss は相手に最も近い着弾までのセル数 */
export type BestCpuShot = { readonly fire: CpuShot; readonly damage: number; readonly miss: number };

/** 粗い角度・パワーの候補を比較する。物理や盤面を書き換えずに射撃を選ぶ。 */
export const bestCpuShot = (state: EngineState): BestCpuShot => {
  const [target, actor] = state.match.players;
  const facing = target.x < actor.x ? -1 : 1;
  let best: BestCpuShot = { fire: { type: "turn.fire", x: actor.x, facing, slot: 0, elevation: 45, power: 60 }, damage: 0, miss: 400 };
  let bestScore = -Infinity;
  for (const slot of [0, 1] as const) {
    for (let elevation = 10; elevation <= 80; elevation += 10) {
      for (let power = 20; power <= 100; power += 10) {
        const fire = { ...best.fire, slot, elevation, power };
        const { result } = simulateShot(state.mask, state.match.players, {
          ...fire, seat: 1, weapon: actor.loadout[slot], y: actor.y, wind: state.match.wind.value,
        });
        const miss = Math.min(400, ...result.impacts.map(hit => Math.abs(hit.cell.x - target.x)));
        const damage = target.hp - result.hpAfter[0];
        const score = damage * 10 - (actor.hp - result.hpAfter[1]) * 15 - miss;
        if (score > bestScore) { bestScore = score; best = { fire, damage, miss }; }
      }
    }
  }
  return best;
};

/** 難易度ごとの照準誤差の最大幅（角度・パワー） */
export const CPU_AIM_SPREAD: Readonly<Record<CpuLevel, { readonly angle: number; readonly power: number }>> = {
  easy: { angle: 14, power: 24 }, normal: { angle: 7, power: 12 }, hard: { angle: 2, power: 5 },
};

/** 照準に角度とパワーのずれを加え、合法範囲に収める */
export const offsetCpuShot = (fire: CpuShot, angle: number, power: number): CpuShot =>
  ({ ...fire, elevation: Math.max(10, Math.min(90, fire.elevation + angle)), power: Math.max(1, Math.min(100, fire.power + power)) });

/** 難易度に応じた誤差を最終照準に加える。誤差を加えた後に命中を再探索しない */
export const aimCpuShot = (fire: CpuShot, level: CpuLevel, rng: () => number): CpuShot => {
  const spread = CPU_AIM_SPREAD[level];
  const offset = (range: number) => Math.floor(rng() * (range * 2 + 1)) - range;
  return offsetCpuShot(fire, offset(spread.angle), offset(spread.power));
};

export const chooseCpuShot = (state: EngineState, level: CpuLevel = "hard", rng: () => number = () => 0.5): CpuShot =>
  aimCpuShot(bestCpuShot(state).fire, level, rng);
