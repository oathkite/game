// テレポートの機体の見え方の時間の流れ（設計書 42.3）。練習（replay.ts）とオンライン（labReplay.ts）が同じ表を使う。
// 弾が着地点に当たった瞬間を 0 とする。光の柱と粒は fx/teleportFx.ts が同じ時刻で描く。

/** 撃った位置で白く光ってから消えるまで（ms） */
export const TELEPORT_DEPART_MS = 140;
/** 着地点に現れる時刻。光の柱が太くなりきる頃 */
export const TELEPORT_ARRIVE_MS = 320;
/** 現れてから白いままの長さ */
export const TELEPORT_WHITE_MS = 280;
/** 光の柱と粒が消えるまで。オンラインの再生は、着弾の後に REPLAY_SETTLE_MS + TELEPORT_HOLD_MS を残す */
export const TELEPORT_FX_MS = 1150;

export type TeleportPose = { readonly at: "from" | "hidden" | "to"; readonly white: boolean };

/** 着弾から t ms の機体の居場所と、白く描くか。動きを減らす設定では白くせず、着弾の瞬間に移す */
export const teleportPoseAt = (t: number, reduced = false): TeleportPose => {
  if (t < 0) return { at: "from", white: false };
  if (reduced) return { at: "to", white: false };
  if (t < TELEPORT_DEPART_MS) return { at: "from", white: true };
  if (t < TELEPORT_ARRIVE_MS) return { at: "hidden", white: false };
  return { at: "to", white: t < TELEPORT_ARRIVE_MS + TELEPORT_WHITE_MS };
};
