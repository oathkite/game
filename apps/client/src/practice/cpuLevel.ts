export type CpuLevel = "easy" | "normal" | "hard";
export const CPU_LEVEL_LABELS: Readonly<Record<CpuLevel, string>> = {
  easy: "やさしい", normal: "ふつう", hard: "むずかしい",
};
export const CPU_LEVEL_HINTS: Readonly<Record<CpuLevel, string>> = {
  easy: "照準が大きくぶれます。操作に慣れたいときに。",
  normal: "照準が少しぶれます。対戦の練習に。",
  hard: "狙いは正確ですが、少し照準がぶれます。",
};
