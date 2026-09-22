import type { CpuLevel } from "./cpuLevel";
import type { EngineState } from "@game/engine";
import type { ClientMessageOf } from "@game/protocol";
import { simulateShot } from "@game/sim";

/** 粗い角度・パワーの候補を比較する。物理や盤面を書き換えずに射撃を選ぶ。 */
export const chooseCpuShot = (state: EngineState, level: CpuLevel = "hard", rng: () => number = () => 0.5): ClientMessageOf<"turn.fire"> => {
  const [target, actor] = state.match.players;
  const facing = target.x < actor.x ? -1 : 1;
  let best: ClientMessageOf<"turn.fire"> = { type: "turn.fire", x: actor.x, facing, slot: 0, elevation: 45, power: 60 };
  let bestScore = -Infinity;
  for (const slot of [0, 1] as const) {
    for (let elevation = 10; elevation <= 80; elevation += 10) {
      for (let power = 20; power <= 100; power += 10) {
        const fire = { ...best, slot, elevation, power };
        const { result } = simulateShot(state.mask, state.match.players, {
          ...fire, seat: 1, weapon: actor.loadout[slot], y: actor.y, wind: state.match.wind.value,
        });
        const distance = Math.min(400, ...result.impacts.map(hit => Math.abs(hit.cell.x - target.x)));
        const score = (target.hp - result.hpAfter[0]) * 10 - (actor.hp - result.hpAfter[1]) * 15 - distance;
        if (score > bestScore) { bestScore = score; best = fire; }
      }
    }
  }
  if (level === "hard") return best;
  const spread = level === "easy" ? { angle: 12, power: 20 } : { angle: 5, power: 8 };
  const offset = (range: number) => Math.floor(rng() * (range * 2 + 1)) - range;
  return { ...best, elevation: Math.max(10, Math.min(90, best.elevation + offset(spread.angle))),
    power: Math.max(1, Math.min(100, best.power + offset(spread.power))) };
};
