// 新しいブラウザ文脈は保存が空なので、「はじめる」が初回のチュートリアルへ入る（設計書 44.1）。
// 既存の spec はロビーから始める前提なので、済みの印を入れた状態で開く。チュートリアルの spec だけ空の状態で上書きする。
export const tutorialSeen = (origin: string) => ({
  cookies: [],
  origins: [{ origin, localStorage: [{ name: "fortress.tutorial.v1", value: "1" }] }],
});
