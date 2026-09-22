import type { LoadingStep } from "./sceneLoadingModel";

type Translate = (text: string) => string;

/** NetworkLab が最初のフレームを待つ間の status の文言。 */
export const LAB_CONNECTING_STATUS = "接続中";
export const LAB_CONNECTED_STATUS = "接続済み";

/** RoomScreen が接続を始めたときに出す status の文言。 */
export const ROOM_CONNECTING_STATUS = "接続しています…";

/**
 * 部屋画面の待ち工程。接続中はサーバーへの接続、入室の応答（welcome）の後で部屋の状態がまだ届いていなければ部屋の同期。
 * 待っていなければ null を返し、呼び出し側は通常の status を出す。
 */
export const roomLoadingSteps = (
  { status, joined, hasRoom }: { readonly status: string; readonly joined: boolean; readonly hasRoom: boolean },
  t: Translate,
): readonly LoadingStep[] | null => {
  if (status === ROOM_CONNECTING_STATUS) return [{ label: t("サーバーへ接続中"), state: "active" }];
  if (!status && joined && !hasRoom) return [{ label: t("サーバーへ接続中"), state: "done" }, { label: t("部屋を同期中"), state: "active" }];
  return null;
};

/** 対戦画面で最初のフレームを待つ工程。status が接続の文言でなければ、どの工程で失敗したかは分からないので、その文言を 1 行の失敗として出す。 */
export const labLoadingSteps = (status: string, t: Translate): readonly LoadingStep[] => {
  if (status === LAB_CONNECTING_STATUS) return [{ label: t("サーバーへ接続中"), state: "active" }];
  if (status === LAB_CONNECTED_STATUS) return [{ label: t("サーバーへ接続中"), state: "done" }, { label: t("対戦データを受信中"), state: "active" }];
  return [{ label: t(status), state: "error" }];
};
