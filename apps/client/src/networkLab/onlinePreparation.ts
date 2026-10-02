import type { LabFrame } from "@game/protocol/v2-lab";
import type { BattleClock } from "./liveView";

/**
 * 相手の手番に、次の自分の手番へ向けて角度と武器と向きを変えられるか（設計書 30 章。37.6 の CPU 戦と同じ規則）。
 * 相手の操作中と相手の射撃の再生中だけ変えられる。自分の手番と自分の射撃の再生、開幕と手番順の演出、対戦の終わり、観戦では変えない。
 * 変えた値は自分の画面だけに出し、発射まで送らない（22.5）。
 */
export const canPrepare = (frame: LabFrame, playerId: string, clock: Pick<BattleClock, "opening" | "revealed">, observing: boolean): boolean =>
  !observing && !clock.opening && clock.revealed && (
    (frame.phase === "acting" && frame.actorId !== playerId) ||
    (frame.phase === "replaying" && frame.replay?.shooter.playerId !== playerId));
