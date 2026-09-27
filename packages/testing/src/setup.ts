import { expect } from "vitest";
import { typedArrayEquality } from "./typedArrayEquality.js";

// 各パッケージの vitest.config.ts の setupFiles から読む。src のコードからは import しない
expect.addEqualityTesters([typedArrayEquality]);
