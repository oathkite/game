import { expect } from "vitest";
import { typedArrayEquality } from "./typedArrayEquality.js";

// 各パッケージの vitest.config.ts の setupFiles から読む。src のコードからは import しない
// setupFiles はテストファイルごとに走り、addEqualityTesters は重複を除かない。
// isolate: false のように global を使い回す設定でも 1 度だけ登録する
const REGISTERED = Symbol.for("@game/testing/typedArrayEquality");
const scope = globalThis as typeof globalThis & { [REGISTERED]?: true };
if (!scope[REGISTERED]) {
  expect.addEqualityTesters([typedArrayEquality]);
  scope[REGISTERED] = true;
}
