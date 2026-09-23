/** シャッターの向き。ふだんの移動 forward は上から下りて上へ開く。対戦へ入る battle はブラウン管が点くように中央から開く。 */
export type ShutterDirection = "forward" | "battle";

/** シャッターが開ききるまでの時間。閉じる側は WorldScenes の timer が同じ長さで入力を止める。 */
export const SHUTTER_OPEN_MS = 400;

/** 対戦へ入る移動だけ battle にする。進むときも戻るときも同じシャッター */
export const shutterDirection = (next: string): ShutterDirection => (next === "battle" ? "battle" : "forward");
