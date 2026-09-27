// 演出の散らし方に使う 32 bit の整数ハッシュ。設計書 41.3。
// Math.random を使わず、同じ入力から同じ値を出す。観戦や再接続を含めてどの画面でも同じ散り方になり、時刻を決めた絵をテストで比べられる。
// 描画のコードだけで使い、勝敗を決める packages/sim とサーバーには入れない。

/** murmur3 の最後の混ぜ。32 bit の整数を均す */
const mix = (h: number): number => {
  let x = h ^ (h >>> 16);
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
};

/** 整数の並び（対戦、ターン、着弾、粒の番号、用途の番号など）から、0 以上 2^32 未満の値を作る。並びの順も値に効く */
export const hash32 = (...parts: readonly number[]): number => {
  let h = 0x9e3779b9;
  for (const part of parts) h = mix((h + Math.imul(part | 0, 0x27d4eb2d)) | 0);
  return h;
};

/** hash32 の値を 0 以上 1 未満に直す */
export const unit = (h: number): number => h / 4294967296;

/** 文字列（対戦の識別子など）を 32 bit の数にする。FNV-1a */
export const hashText = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
};
