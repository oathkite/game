// 曲の定義で共有する記譜の部品。
import { concat, phrase } from "../score.mjs";

/** 和音記号の根音名。"C#m7" なら "C#" */
export const root = (symbol) => /^([A-G][#b]?)/.exec(symbol)[1];

const PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** ベースの音域（A1 から G#2）に収めた根音。up でオクターブを上げる */
export const low = (name, up = 0) => {
  const pc = (PITCH_CLASS[name[0]] + (name[1] === "#" ? 1 : name[1] === "b" ? -1 : 0) + 12) % 12;
  return `${name}${(pc >= 9 ? 1 : 2) + up}`;
};

/** 和音記号ごとに 1 小節の記譜を作ってつなぐ */
export const perBar = (symbols, bar) => concat(...symbols.map((symbol) => phrase(bar(root(symbol), symbol))));

/** 和音記号を 1 小節ずつ伸ばした和音の記譜。voicing は記号から "A3+D4+F4" への表 */
export const chords = (symbols, voicing, steps = 16) =>
  phrase(symbols.map((symbol) => `${voicing[symbol]}/${steps}`).join(" "));

/** 1 回だけ鳴らす長い音。スイープやクラッシュの置き場所に使う */
export const hold = (steps, vel = 0.8, lead = 0) => ({ steps: lead + steps, events: [{ step: lead, steps, notes: [], vel }] });

/** 最初の step だけ鳴らす小節。クラッシュを小節の頭に置く */
export const downbeat = (vel = 1) => ({ steps: 16, events: [{ step: 0, steps: 1, notes: [], vel }] });

/** 決まった小節に 1 回だけ置く層を作る */
export const at = (bar, layer) => ({ ...layer, from: bar, to: bar + 1 });
