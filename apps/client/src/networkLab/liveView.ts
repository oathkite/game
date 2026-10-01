import type { LabFrame } from "@game/protocol/v2-lab";
import { presentLabReplay } from "./labReplay";
import type { OwnPose } from "./movePrediction";

// オンライン対戦の表示を、毎フレーム変わるものと、React が描き直すものに分ける。
// 毎フレーム変わる位置と再生は描画ループ（NetworkField）が直接読み、React は秒や操作の可否が変わったときだけ描き直す。

type Position = { readonly playerId: string; readonly x: number; readonly y: number };
export type Presentation = ReturnType<typeof presentLabReplay>;
/** frame はこの表示を作った受信 frame。描画ループは props の frame ではなくこれを使い、位置と手番の情報を同じ時点に揃える。
    own は自分の手番の移動の予測（positions の自機はこの位置になっている） */
export type LiveSample = { readonly frame: LabFrame; readonly serverNow: number; readonly presentation: Presentation; readonly players: LabFrame["players"]; readonly own: OwnPose | null };

/** serverNow の時点の表示。再生中は再生の位置、それ以外は受信 buffer で補間した位置を参加者に重ねる */
export const sampleLive = (frame: LabFrame, serverNow: number, positions: readonly Position[], reduced: boolean, own: OwnPose | null = null): LiveSample => {
  const presentation = presentLabReplay(frame, serverNow, reduced);
  const players = frame.phase === "replaying" ? presentation.players : positions.flatMap(p => {
    const player = frame.players.find(q => q.playerId === p.playerId);
    return player ? [{ ...player, x: p.x, y: p.y }] : [];
  });
  return { frame, serverNow, presentation, players, own };
};

/** React が描き直す値。serverNow はこの値を作った時刻で、次に描き直すまで進まない */
export type BattleClock = {
  readonly serverNow: number;
  readonly seconds: number | null;
  readonly opening: boolean;
  /** 手番順の演出（revealUntil）が終わった */
  readonly revealed: boolean;
  readonly returnSeconds: number | null;
  /** 自機の表示位置。地面の傾きを出すのに使う。整数のセルに丸める */
  readonly own: { readonly x: number; readonly y: number } | null;
  /** 表示している地形の削り跡の数 */
  readonly terrain: number;
  /** 自分の手番の移動の予測。操作盤の向きと残り移動に出す */
  readonly move: Pick<OwnPose, "facing" | "stepsLeft"> | null;
};

export const battleClock = (frame: LabFrame, live: LiveSample, ownId: string): BattleClock => {
  const { serverNow } = live, own = live.players.find(p => p.playerId === ownId);
  return {
    serverNow,
    seconds: frame.phase === "acting" ? Math.max(0, Math.min(20, Math.ceil((frame.deadlineAt - serverNow) / 1000))) : null,
    opening: Boolean(frame.opening && serverNow < frame.opening.endsAt),
    revealed: serverNow >= (frame.delay?.revealUntil ?? 0),
    returnSeconds: frame.returnStatus ? Math.max(0, Math.ceil((frame.returnStatus.deadlineAt - serverNow) / 1000)) : null,
    own: own ? { x: Math.round(own.x), y: Math.round(own.y) } : null,
    terrain: live.presentation.terrainOps.length,
    move: live.own ? { facing: live.own.facing, stepsLeft: live.own.stepsLeft } : null,
  };
};

/** serverNow を除いた値が同じなら同じ文字列。変わったときだけ React の state を更新する */
export const clockKey = (clock: BattleClock): string =>
  [clock.seconds, clock.opening, clock.revealed, clock.returnSeconds, clock.own?.x, clock.own?.y, clock.terrain, clock.move?.facing, clock.move?.stepsLeft].join("|");
