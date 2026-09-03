import { describe, expect, it } from "vitest";
import { GOLDEN_CASES, runGolden } from "../src/golden.js";

// golden replay。最初の記録はこの実装で生成したもので、独立に導いた値ではない。
// 物理コードを変えたらスナップショットを更新し、差分が意図した変更だけであることをレビューで確認する。
// 同じケースを apps/e2e がブラウザで走らせ、Node の結果と比べる。

describe("golden replay", () => {
  for (const c of GOLDEN_CASES) {
    it(c.name, () => {
      const { result, steps, last } = runGolden(c);
      expect({ result, steps, last }).toMatchSnapshot();
    });
  }
});
