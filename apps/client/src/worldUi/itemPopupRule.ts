import type { ItemId } from "@game/protocol";
import type { LabFrame } from "@game/protocol/v2-lab";
import { ITEM_POPUP_MS } from "@/game/itemPopup";

// 相手がアイテムを使ったときに、撃った機体の上へアイコンを出す規則（設計書 42.8）。NetworkField から呼ぶ純関数。

/**
 * 再生が始まってからこの時間を過ぎて見た射撃には出さない。途中参加や再接続で古い射撃を告げない。
 * startsAt はサーバーが射撃を受けた時刻なので、相手には片道の遅延のぶん遅れて届く。効果音の 500 ms より長く、アイコンが出ている時間と同じにする
 */
export const ITEM_POPUP_FRESH_MS = ITEM_POPUP_MS;

export type ItemPopupFrame = Pick<LabFrame, "phase"> & {
  readonly replay: null | { readonly startsAt: number; readonly shooter: { readonly playerId: string; readonly item?: ItemId | undefined } };
};

export type ItemPopupDecision = { readonly key: number; readonly playerId: string; readonly item: ItemId; readonly show: boolean };

/**
 * まだ扱っていない再生でアイテムが使われていれば、その射撃を返す。show が偽なら印だけ付けて出さない。
 * 自分の射撃には出さない。相手の選択は射撃確定まで見えないので（42.1）、再生が始まるまでは何も返さない。
 */
export const itemPopupOf = (frame: ItemPopupFrame, ownId: string, serverNow: number, handled: number | null): ItemPopupDecision | null => {
  const replay = frame.phase === "replaying" ? frame.replay : null;
  const item = replay?.shooter.item;
  if (!replay || !item || replay.startsAt === handled || serverNow < replay.startsAt) return null;
  const show = replay.shooter.playerId !== ownId && serverNow - replay.startsAt <= ITEM_POPUP_FRESH_MS;
  return { key: replay.startsAt, playerId: replay.shooter.playerId, item, show };
};
