export type LoadingStep = { readonly label: string; readonly state: "done" | "active" | "error" };

/** これより早く終わる待ちでは何も出さない（チラつき防止）。 */
export const LOADING_DELAY_MS = 150;
/** 進行中の工程を打ち出す速さ。 */
export const LOADING_TYPE_MS = 28;
/** 工程数のバーのドット数。 */
export const LOADING_DOTS = 10;

/** done の工程の割合を dots 個のドットに切り捨てで写す。偽の % は作らない。 */
export const filledDots = (steps: readonly LoadingStep[], dots = LOADING_DOTS): number =>
  steps.length === 0 ? 0 : Math.floor(steps.filter(step => step.state === "done").length * dots / steps.length);

/** バーは工程が 2 つ以上あるときだけ出す。 */
export const showsProgress = (steps: readonly LoadingStep[]): boolean => steps.length >= 2;

/** 読み上げ用の文。打ち出し途中ではなく、いまの工程の全文を返す。 */
export const loadingAnnouncement = (steps: readonly LoadingStep[]): string => {
  const current = steps.find(step => step.state === "active") ?? steps.find(step => step.state === "error") ?? steps.at(-1);
  if (!current) return "";
  return current.state === "active" ? current.label : `${current.label} ${current.state === "error" ? "NG" : "OK"}`;
};
