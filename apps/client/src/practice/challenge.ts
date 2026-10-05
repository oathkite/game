import type { Profile } from "@/app/profile";
import { EMPTY_VIEW, type MatchView, type PlayerView } from "@/match/types";
import { simulateCombatWithItem, STEPS_PER_TURN } from "@game/sim";
import { shotWeapon } from "@game/protocol";
import { challengeStatus, resolveTargets, TARGET_HEIGHT, type ChallengeStatus, type Target } from "./rules";
import { createStageMask, createTargets, type ChallengeStage } from "./stages";

/** endless は的をすべて壊しても終えない。items はアイテムを選んで撃てる。どちらもチュートリアル用（設計書 44） */
export type ChallengeOptions = { readonly endless?: boolean; readonly items?: boolean };

export type ChallengeState = {
  readonly view: MatchView;
  readonly targets: readonly Target[];
  readonly used: number;
  readonly status: ChallengeStatus;
  readonly pendingTargets: readonly Target[] | null;
};

export const initialChallenge = (stage: ChallengeStage, profile: Profile): ChallengeState => {
  const player: PlayerView = { seat: 0, nickname: "", colors: profile.colors, loadout: stage.loadout, hp: 100, x: stage.start[0], y: stage.start[1], facing: 1, connected: true };
  const other: PlayerView = { ...player, seat: 1, x: 399, y: 225 };
  return {
    view: { ...EMPTY_VIEW, phase: "acting", mask: createStageMask(stage), players: [player, other], mySeat: 0, wind: { value: stage.wind },
      control: { x: player.x, y: player.y, facing: 1, elevation: 45, slot: 0, item: null, stepsLeft: STEPS_PER_TURN, fell: false } },
    targets: createTargets(stage), used: 0, status: "playing", pendingTargets: null,
  };
};

export const fireChallenge = (state: ChallengeState, power: number): ChallengeState => {
  const { view } = state;
  const c = view.control;
  if (state.status !== "playing" || view.phase !== "acting" || !c || !view.mask || !view.players) return state;
  if (!Number.isInteger(power) || power < 0 || power > 100) return state;
  const targets = state.targets.filter((t) => !t.destroyed).map((t) => ({ x: t.x, y: t.y - TARGET_HEIGHT + 3, hp: 100 }));
  const item = c.item ?? undefined;
  // テレポートは選んだ武器に関わらず標準砲の弾道で飛ぶ（設計書 42.3）
  const input = { seat: 0 as const, weapon: shotWeapon(view.players[0].loadout[c.slot], item), x: c.x, y: c.y, facing: c.facing, elevation: c.elevation, power, wind: view.wind.value, ...(item ? { item } : {}) };
  const outcome = simulateCombatWithItem(view.mask, [{ ...view.players[0], x: c.x, y: c.y }, view.players[1], ...targets], 0, input, false);
  const shot = { mask: outcome.mask, paths: outcome.paths, result: { input,
    impacts: outcome.impacts.map((impact) => ({ ...impact, damage: [0, 0] as const })),
    hpAfter: [100, 100] as const, xAfter: [outcome.positions[0]!.x, outcome.positions[1]!.x] as const,
    yAfter: [outcome.positions[0]!.y, outcome.positions[1]!.y] as const,
    ringOut: outcome.ringOut.filter((seat): seat is 0 | 1 => seat === 0 || seat === 1), finished: null } };

  const before: readonly [PlayerView, PlayerView] = [{ ...view.players[0], x: c.x, y: c.y, facing: c.facing }, view.players[1]];
  // 練習では自爆ダメージを使わず、場外落下だけを失敗条件にする。
  const used = item ? { itemsUsed: [...(before[0].itemsUsed ?? []), item] } : {};
  const after: readonly [PlayerView, PlayerView] = [{ ...before[0], x: shot.result.xAfter[0], y: shot.result.yAfter[0], ...used }, before[1]];
  return { ...state, used: state.used + 1,
    pendingTargets: resolveTargets(shot.mask, state.targets, shot.result.impacts.map((i) => i.terrainOp)),
    view: { ...view, phase: "replaying", control: null, replay: { id: state.used + 1, shot: shot.result, paths: shot.paths, maskBefore: view.mask, maskAfter: shot.mask, playersBefore: before, playersAfter: after,
      ...(outcome.firstShot ? { firstShot: outcome.firstShot } : {}) } },
  };
};

export const completeChallenge = (state: ChallengeState, stage: ChallengeStage, id: number, endless = false): ChallengeState => {
  const job = state.view.replay;
  if (!job || job.id !== id || !state.pendingTargets) return state;
  const p = job.playersAfter[0];
  const ringOut = p.y >= job.maskAfter.height;
  // endless では的をすべて壊しても、弾数を使い切っても終えず、場外に落ちたときだけ失敗にする
  const status = endless ? (ringOut ? "failed" : "playing") : challengeStatus(state.pendingTargets, state.used, stage.shots, ringOut);
  return { ...state, status, targets: state.pendingTargets, pendingTargets: null,
    view: { ...state.view, phase: status === "playing" ? "acting" : "finished", mask: job.maskAfter, players: job.playersAfter, replay: null,
      control: status === "playing" ? { x: p.x, y: p.y, facing: p.facing, elevation: state.view.lastElevation, slot: state.view.lastSlot, item: null, stepsLeft: STEPS_PER_TURN, fell: false } : null },
  };
};
