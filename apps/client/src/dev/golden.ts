import { goldenDump } from "@game/sim";

// ブラウザで golden replay を走らせ、結果を文字列で置く。apps/e2e が Node の結果と比べる。
// 設計書 07 の 7.5「クロス環境」。開発サーバーの /golden.html からだけ使う。

const out = goldenDump();
const el = document.getElementById("out");
if (el) el.textContent = out;
(window as Window & { __golden?: string }).__golden = out;
