/** シャッターの向き。奥へ進む forward は左から右、戻る back は右から左、対戦へ入る battle はブラウン管が点くように中央から開く。 */
export type ShutterDirection = "forward" | "back" | "battle";

/** 対戦へ入る移動は呼び出し側の指定によらず battle にする。 */
export const shutterDirection = (next: string, requested: Exclude<ShutterDirection, "battle"> = "forward"): ShutterDirection =>
  next === "battle" ? "battle" : requested;
