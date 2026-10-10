// Chromium は new headless（channel: "chromium"）で動かす。
// 既定の headless shell は、WebGL のフィールドの上に重ねた要素（全体図など）の下を上下反転した位置で抜き、
// 無いはずの黒い矩形を写す（設計書 7.5）。headed と new headless では写らない。
export const chromium = { browserName: "chromium", channel: "chromium" } as const;
