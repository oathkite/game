import { describe, expect, it } from "vitest";
import { typedArrayEquality } from "../src/typedArrayEquality.js";

describe("typedArrayEquality", () => {
  it("同じ型で中身が同じなら等しい", () => {
    expect(typedArrayEquality(new Uint8Array([0, 1, 1]), new Uint8Array([0, 1, 1]))).toBe(true);
    expect(typedArrayEquality(new Int32Array([-5, 7]), new Int32Array([-5, 7]))).toBe(true);
  });

  it("空の配列どうしは等しい", () => {
    expect(typedArrayEquality(new Uint8Array(), new Uint8Array())).toBe(true);
  });

  it("1 要素でも違えば等しくない", () => {
    const a = new Uint8Array(400 * 225).fill(1);
    const b = a.slice();
    b[b.length - 1] = 0;
    expect(typedArrayEquality(a, b)).toBe(false);
  });

  it("長さが違えば等しくない", () => {
    expect(typedArrayEquality(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
    expect(typedArrayEquality(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false);
  });

  it("型が違えば中身が同じでも等しくない", () => {
    // Node の Buffer と同じく、Uint8Array のサブクラスも別の型として扱う
    class Bytes extends Uint8Array {}
    const a = new Uint8Array([1, 2]);
    expect(typedArrayEquality(a, new Uint8ClampedArray([1, 2]))).toBe(false);
    expect(typedArrayEquality(a, new Int8Array([1, 2]))).toBe(false);
    expect(typedArrayEquality(a, new Bytes([1, 2]))).toBe(false);
  });

  it("どちらかが typed array でなければ判断を既定の比較に任せる", () => {
    const a = new Uint8Array([1, 2]);
    for (const other of [[1, 2], new DataView(new ArrayBuffer(2)), new ArrayBuffer(2), { 0: 1, 1: 2, length: 2 }, null, undefined, 1]) {
      expect(typedArrayEquality(a, other)).toBeUndefined();
      expect(typedArrayEquality(other, a)).toBeUndefined();
    }
    expect(typedArrayEquality([1, 2], [1, 2])).toBeUndefined();
    expect(typedArrayEquality(new DataView(new ArrayBuffer(2)), new DataView(new ArrayBuffer(2)))).toBeUndefined();
  });

  it("要素は既定の比較と同じく Object.is で比べる", () => {
    expect(typedArrayEquality(new Float64Array([Number.NaN]), new Float64Array([Number.NaN]))).toBe(true);
    expect(typedArrayEquality(new Float64Array([0]), new Float64Array([-0]))).toBe(false);
  });

  it("BigInt64Array も比べる", () => {
    expect(typedArrayEquality(new BigInt64Array([1n, -2n]), new BigInt64Array([1n, -2n]))).toBe(true);
    expect(typedArrayEquality(new BigInt64Array([1n, -2n]), new BigInt64Array([1n, 2n]))).toBe(false);
  });

  it("offset のある subarray は、見えている範囲の中身だけで比べる", () => {
    const a = new Uint8Array([9, 1, 2, 9]).subarray(1, 3);
    const b = new Uint8Array([7, 7, 1, 2]).subarray(2);
    expect(typedArrayEquality(a, b)).toBe(true);
    expect(typedArrayEquality(a, new Uint8Array([1, 3]))).toBe(false);
  });
});

// vitest.config.ts の setupFiles で登録した状態を確かめる。ほかのパッケージも同じ setup を読む
describe("setup で登録した tester", () => {
  const mask = () => ({ width: 400, height: 225, cells: new Uint8Array(400 * 225).fill(1) });

  it("toEqual と toStrictEqual が、入れ子の typed array を中身で比べる", () => {
    expect(mask()).toEqual(mask());
    expect(mask()).toStrictEqual(mask());
    const changed = mask();
    changed.cells[1234] = 0;
    expect(changed).not.toEqual(mask());
    expect(changed.cells).not.toStrictEqual(mask().cells);
    expect(new Uint8Array([1])).not.toEqual(new Int8Array([1]));
  });

  it("not.toBe は、中身が同じでも別の配列なら通る", () => {
    const a = mask();
    expect(a.cells).not.toBe(mask().cells);
    expect(() => expect(a.cells).not.toBe(a.cells)).toThrow();
  });

  it("既定の比較と違い、添字以外の独自プロパティは比べない", () => {
    expect(Object.assign(new Uint8Array([1]), { extra: 1 })).toEqual(new Uint8Array([1]));
  });
});
