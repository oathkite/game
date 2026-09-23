/** シャッターの向き。奥へ進む forward は上から下りて上へ開き、戻る back は下から上がって下へ開く。対戦へ入る battle はブラウン管が点くように中央から開く。 */
export type ShutterDirection = "forward" | "back" | "battle";

/** シャッターが開ききるまでの時間。閉じる側は WorldScenes の timer が同じ長さで入力を止める。 */
export const SHUTTER_OPEN_MS = 400;

/** 対戦へ入る移動は呼び出し側の指定によらず battle にする。 */
export const shutterDirection = (next: string, requested: Exclude<ShutterDirection, "battle"> = "forward"): ShutterDirection =>
  next === "battle" ? "battle" : requested;
