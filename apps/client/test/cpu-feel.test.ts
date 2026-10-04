import { describe, expect, it } from "vitest";
import { createEngine, DEFAULT_ENGINE_TIMING, type EngineState } from "@game/engine";
import type { TrajectoryInput } from "@game/protocol";
import { simulateShot } from "@game/sim";
import { chooseCpuShot } from "../src/practice/cpu";
import { planCpuTurn } from "../src/practice/cpuTurn";

// CPU戦の位置取りの手触りを数値で固定する（設計書 37.6）。
// 開始配置だけでなく、地形が削れて HP に差がある対戦途中の盤面でも確かめるため、
// プレイヤー役（ほどほどの精度）と CPU に交互に撃たせて盤面を進める。
// 「今の位置から当てられない」場面はこの進め方ではほぼ生じないため、cpuTurn.test.ts の屋根の盤面で確かめる。

const MAPS = ["ridgeline", "stone-bridge", "terraces", "sky-islands"] as const;
const SEEDS = [1, 2, 3, 4, 5, 6];
const CPU_TURNS = 4;

const seeded = (seed: number) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const withCpuAt = (state: EngineState, x: number, y: number): EngineState =>
  ({ ...state, match: { ...state.match, players: [state.match.players[0], { ...state.match.players[1], x, y }] as const } });
const damageTo = (state: EngineState, seat: 0 | 1, input: TrajectoryInput) =>
  state.match.players[seat].hp - simulateShot(state.mask, state.match.players, input).result.hpAfter[seat];
const cpuInput = (state: EngineState, fire: ReturnType<typeof chooseCpuShot>): TrajectoryInput => {
  const actor = state.match.players[1];
  return { ...fire, seat: 1, weapon: actor.loadout[fire.slot], y: actor.y, wind: state.match.wind.value };
};
const canHitAt = (state: EngineState, x: number, y: number) => {
  const moved = withCpuAt(state, x, y);
  return damageTo(moved, 0, cpuInput(moved, chooseCpuShot(moved, "hard", () => 0.5))) > 0;
};
/** 直前に被弾した相手の射撃を、同じ入力でこの位置へ撃たれたら再び被弾するか */
const exposedAt = (state: EngineState, x: number, y: number) => {
  const last = state.lastResult?.shot;
  if (!last || last.input.seat !== 0 || !last.impacts.some(hit => hit.damage[1] > 0)) return false;
  return damageTo(withCpuAt(state, x, y), 1, last.input) > 0;
};

/** プレイヤー役。粗い探索の最善手に ±6 度・±10 の誤差を加えて撃つ */
const playerInput = (state: EngineState, rng: () => number): TrajectoryInput => {
  const [actor, target] = state.match.players;
  const facing = target.x < actor.x ? -1 : 1;
  let best: TrajectoryInput = { seat: 0, x: actor.x, y: actor.y, facing, weapon: actor.loadout[0], elevation: 45, power: 60, wind: state.match.wind.value };
  let bestScore = -Infinity;
  for (let elevation = 10; elevation <= 80; elevation += 10) for (let power = 20; power <= 100; power += 10) {
    const input = { ...best, elevation, power };
    const { result } = simulateShot(state.mask, state.match.players, input);
    const miss = Math.min(400, ...result.impacts.map(hit => Math.abs(hit.cell.x - target.x)));
    const score = (target.hp - result.hpAfter[1]) * 10 - (actor.hp - result.hpAfter[0]) * 15 - miss;
    if (score > bestScore) { bestScore = score; best = input; }
  }
  const offset = (range: number) => Math.floor(rng() * (range * 2 + 1)) - range;
  return { ...best, elevation: Math.max(10, Math.min(90, best.elevation + offset(6))), power: Math.max(1, Math.min(100, best.power + offset(10))) };
};

const apply = (state: EngineState, input: TrajectoryInput, turnNumber: number, wind: number): EngineState => {
  const { mask, result } = simulateShot(state.mask, state.match.players, input);
  const players = state.match.players.map((p, i) => ({ ...p, x: result.xAfter[i]!, y: result.yAfter[i]!, hp: result.hpAfter[i]! })) as unknown as EngineState["match"]["players"];
  return { ...state, mask, lastResult: { type: "turn.result", turnNumber, shot: result, finished: null },
    match: { ...state.match, players, wind: { ...state.match.wind, value: wind } } };
};

type Decision = { readonly stayCanHit: boolean; readonly stayExposed: boolean; readonly moved: boolean; readonly destCanHit: boolean; readonly destExposed: boolean; readonly selfDamage: number };

const playOut = (mapName: typeof MAPS[number], seed: number): Decision[] => {
  const rng = seeded(seed * 97 + mapName.length);
  let state = createEngine({ ...DEFAULT_ENGINE_TIMING, rng }, { roomCode: "FEEL00", mapName, players: [
    { nickname: "P", colors: { primary: "red", secondary: "yellow" }, loadout: ["cannon", "triple"] },
    { nickname: "CPU", colors: { primary: "cyan", secondary: "blue" }, loadout: ["cannon", "triple"] },
  ] });
  const decisions: Decision[] = [];
  const wind = () => Math.floor(rng() * 21) - 10;
  for (let turn = 0; turn < CPU_TURNS; turn++) {
    state = apply(state, playerInput(state, rng), turn * 2, wind());
    if (state.lastResult?.shot.finished) break;
    const actor = state.match.players[1];
    const plan = planCpuTurn(state, "normal", 45, rng);
    const y = plan.frames.at(-1)!.pose.y;
    decisions.push({ stayCanHit: canHitAt(state, actor.x, actor.y), stayExposed: exposedAt(state, actor.x, actor.y),
      moved: plan.fire.x !== actor.x, destCanHit: canHitAt(state, plan.fire.x, y), destExposed: exposedAt(state, plan.fire.x, y),
      selfDamage: damageTo(withCpuAt(state, plan.fire.x, y), 1, cpuInput(withCpuAt(state, plan.fire.x, y), plan.fire)) });
    state = apply(withCpuAt(state, plan.fire.x, y), cpuInput(withCpuAt(state, plan.fire.x, y), plan.fire), turn * 2 + 1, wind());
    if (state.lastResult?.shot.finished) break;
  }
  return decisions;
};

describe("CPU戦の位置取りの手触り", () => {
  const decisions = MAPS.flatMap(map => SEEDS.flatMap(seed => playOut(map, seed)));
  const rate = (list: readonly Decision[], pick: (d: Decision) => boolean) => list.filter(pick).length / list.length;

  it("対戦途中を含めて十分な場面を集める", () => {
    expect(decisions.length).toBeGreaterThanOrEqual(60);
    expect(decisions.some(d => d.stayExposed)).toBe(true);
  });

  it("留まれば当てられる場面で、当てられない位置へは動かない", () => {
    expect(decisions.filter(d => d.stayCanHit && !d.destCanHit)).toEqual([]);
  });

  it("被弾した位置が再び狙われるなら、ほとんどの場面で狙われない位置へ逃げる", () => {
    const exposed = decisions.filter(d => d.stayExposed);
    expect(rate(exposed, d => d.moved && !d.destExposed)).toBeGreaterThanOrEqual(0.8);
  });

  it("照準の誤差を含めても、自分を巻き込む射撃は 2% 以下", () => {
    expect(rate(decisions, d => d.selfDamage > 0)).toBeLessThanOrEqual(0.02);
  });

  it("理由のない場面では、常に停止にも常に移動にもならない", () => {
    const neutral = decisions.filter(d => d.stayCanHit && !d.stayExposed);
    const moved = rate(neutral, d => d.moved);
    expect(moved).toBeGreaterThanOrEqual(0.15);
    expect(moved).toBeLessThanOrEqual(0.55);
  });
});

describe("CPU戦の難易度ごとの命中率", () => {
  // 開始配置で風を変え、1 手目の命中率を測る。位置取りを変えても難易度の差を保つ（設計書 37.6）
  const hitRate = (level: "easy" | "normal" | "hard") => {
    let hits = 0, shots = 0;
    for (const mapName of MAPS) for (let seed = 1; seed <= 10; seed++) {
      const rng = seeded(seed * 31 + mapName.length);
      const base = createEngine({ ...DEFAULT_ENGINE_TIMING, rng }, { roomCode: "FEEL00", mapName, players: [
        { nickname: "P", colors: { primary: "red", secondary: "yellow" }, loadout: ["cannon", "triple"] },
        { nickname: "CPU", colors: { primary: "cyan", secondary: "blue" }, loadout: ["cannon", "triple"] },
      ] });
      const state = { ...base, match: { ...base.match, wind: { ...base.match.wind, value: Math.floor(rng() * 21) - 10 } } };
      const plan = planCpuTurn(state, level, 45, rng);
      const moved = withCpuAt(state, plan.fire.x, plan.frames.at(-1)!.pose.y);
      shots++;
      if (damageTo(moved, 0, cpuInput(moved, plan.fire)) > 0) hits++;
    }
    return hits / shots;
  };
  const rates = { easy: hitRate("easy"), normal: hitRate("normal"), hard: hitRate("hard") };

  it("むずかしいは55〜80%、ふつう・やさしいは10〜40%で、むずかしいが最も当てる", () => {
    expect(rates.hard).toBeGreaterThanOrEqual(0.55);
    expect(rates.hard).toBeLessThanOrEqual(0.8);
    for (const level of ["easy", "normal"] as const) {
      expect(rates[level]).toBeGreaterThanOrEqual(0.1);
      expect(rates[level]).toBeLessThanOrEqual(0.4);
      expect(rates[level]).toBeLessThan(rates.hard);
    }
  });
});
