// vitest の既定の比較（iterableEquality）は、typed array を 1 要素ずつ汎用の equals に通したうえ、
// Object.entries で全要素の [key, value] を作って比べ直す。400x225 の地形 1 枚で 100ms を超え、
// CI では 5 秒の制限にかかる。同じ型の typed array どうしは、ここで単純なループで比べる。
//
// 既定との違い: 添字以外の独自プロパティは比べない。
// 要素は既定と同じく Object.is で比べる（NaN どうしは等しく、+0 と -0 は等しくない）。

type TypedArray = ArrayBufferView & ArrayLike<number | bigint>;

const isTypedArray = (value: unknown): value is TypedArray =>
  ArrayBuffer.isView(value) && !(value instanceof DataView);

/** vitest の Tester。typed array どうしでなければ undefined を返し、判断を既定の比較に任せる */
export const typedArrayEquality = (a: unknown, b: unknown): boolean | undefined => {
  if (!isTypedArray(a) || !isTypedArray(b)) return undefined;
  if (a.constructor !== b.constructor || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
};
