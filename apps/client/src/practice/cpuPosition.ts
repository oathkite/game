import type { EngineState } from "@game/engine";
import type { Facing } from "@game/protocol";
import { simulateShot, stepOutcome } from "@game/sim";
import { bestCpuShot, type CpuShot } from "./cpu";

// CPU の位置取り（設計書 37.6）。移動は理由のあるものに限る。
// 候補ごとに照準を探索して「当てられる位置か」を、直前に被弾していれば相手の同じ射撃で「狙われている位置か」を調べる。

type Step = { readonly x: number; readonly y: number; readonly facing: Facing };
export type PositionOption = {
  readonly x: number;
  readonly steps: number;
  readonly path: readonly Step[];
  /** 誤差なしの最善手で相手にダメージを与えられる */
  readonly canHit: boolean;
  /** 直前に被弾した相手の射撃を、同じ入力でこの位置へ撃たれると再び被弾する */
  readonly exposed: boolean;
  /** 最善手の着弾から相手までのセル数 */
  readonly miss: number;
  /** この位置での誤差なしの最善手 */
  readonly fire: CpuShot;
};

/** 理由のない場面で位置を変える確率。「常に停止」に戻らないための初期値 */
export const CPU_REPOSITION_CHANCE = 0.35;
const STOPS = [6, 12, 18] as const;

/** 崖からの落下・障害物・相手機体への接近を避けて歩ける経路。歩けなくなったらそこで止める */
const safePath = (state: EngineState, direction: Facing): Step[] => {
  const [target, actor] = state.match.players;
  const path: Step[] = [];
  let position = { x: actor.x, y: actor.y };
  for (let i = 0; i < STOPS.at(-1)!; i++) {
    const next = stepOutcome(state.mask, position, direction);
    if (next.kind !== "moved" || next.y >= state.mask.height || Math.abs(position.x + direction - target.x) < 18) break;
    position = { x: position.x + direction, y: next.y };
    path.push({ ...position, facing: direction });
  }
  return path;
};

/** 留まると、左右それぞれ 6・12・18 歩先（歩けなければ歩けたところまで）の経路 */
const candidatePaths = (state: EngineState): (readonly Step[])[] => {
  const paths: (readonly Step[])[] = [[]];
  for (const direction of [-1, 1] as const) {
    const path = safePath(state, direction);
    const stops = new Set(STOPS.map(stop => Math.min(stop, path.length)).filter(stop => stop > 0));
    for (const stop of stops) paths.push(path.slice(0, stop));
  }
  return paths;
};

const exposedAt = (state: EngineState): boolean => {
  const last = state.lastResult?.shot;
  if (!last || last.input.seat !== 0 || !last.impacts.some(hit => hit.damage[1] > 0)) return false;
  const actor = state.match.players[1];
  return simulateShot(state.mask, state.match.players, last.input).result.hpAfter[1] < actor.hp;
};

/** 各候補の位置で照準を探索し、当てられるか・狙われているかを調べる。盤面は書き換えない */
export const positionOptions = (state: EngineState): PositionOption[] => candidatePaths(state).map(path => {
  const [target, actor] = state.match.players;
  const end = path.at(-1) ?? actor;
  const moved = { ...state, match: { ...state.match, players: [target, { ...actor, x: end.x, y: end.y }] as const } };
  const best = bestCpuShot(moved);
  return { x: end.x, steps: path.length, path, canHit: best.damage > 0, exposed: exposedAt(moved), miss: best.miss, fire: best.fire };
});

const fewestSteps = (options: readonly PositionOption[]) =>
  options.reduce((best, o) => o.steps < best.steps || (o.steps === best.steps && o.miss < best.miss) ? o : best);
const closest = (options: readonly PositionOption[]) => options.reduce((best, o) => o.miss < best.miss ? o : best);

/** 先頭は「留まる」。設計書 37.6 の順で位置を選ぶ */
export const choosePosition = (options: readonly PositionOption[], rng: () => number): PositionOption => {
  const stay = options[0]!;
  const safe = options.filter(o => o.canHit && !o.exposed);
  if (stay.canHit && !stay.exposed) {
    const others = safe.filter(o => o !== stay);
    if (others.length === 0 || rng() >= CPU_REPOSITION_CHANCE) return stay;
    return others[Math.min(others.length - 1, Math.floor(rng() * others.length))]!;
  }
  if (safe.length > 0) return fewestSteps(safe);
  const hitting = options.filter(o => o.canHit);
  if (hitting.length > 0) return fewestSteps(hitting);
  const unexposed = options.filter(o => !o.exposed);
  return closest(unexposed.length > 0 ? unexposed : options);
};
