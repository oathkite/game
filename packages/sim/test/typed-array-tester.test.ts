import { expect, it } from "vitest";

// vitest.config.ts の setupFiles が @game/testing/setup を読んでいることを確かめる。
// 読んでいれば typed array は tester で比べ、既定の比較と違って添字以外の独自プロパティを見ない
it("setupFiles で typed array の tester を読む", () => {
  expect(Object.assign(new Uint8Array([1]), { extra: 1 })).toEqual(new Uint8Array([1]));
});
