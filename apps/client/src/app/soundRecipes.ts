import type { WeaponSound } from "./weaponSounds";
import type { Layer, NoiseLayer, Recipe, ToneLayer } from "./sfx";

// 効果音の設計。発射は「破裂の立ち上がり + 胴の低音 + 爆風のノイズ」、着弾は「サブの低音 + 破裂 + 低域へ沈む余韻」を基本形にする。
// 多段の武器（レーザー 7 段、マルチ 9 発）は 1 回を短く軽くし、連続しても濁らないようにする。

export type SoundName = WeaponSound | "move" | "tick" | "fire" | "explosion" | "hit" | "hitConfirm" | "finish" | "matchFinish";

type Extra<T> = Partial<Omit<T, "kind" | "wave" | "filter" | "from" | "to" | "duration" | "gain">>;
const tone = (wave: OscillatorType, from: number, to: number, duration: number, gain: number, extra: Extra<ToneLayer> = {}): ToneLayer =>
  ({ kind: "tone", wave, from, to, duration, gain, ...extra });
const noise = (filter: BiquadFilterType, from: number, to: number, duration: number, gain: number, extra: Extra<NoiseLayer> = {}): NoiseLayer =>
  ({ kind: "noise", filter, from, to, duration, gain, ...extra });

/** 破裂の頭。高域のノイズを数十 ms だけ鳴らし、小さい再生機でも「当たった」とわかる輪郭を作る */
const crack = (duration = 0.05, gain = 0.7, delay = 0): Layer => noise("highpass", 2600, 1400, duration, gain, { delay });
/** 胸に来る低音。正弦波の音程を急に落とす */
const thump = (from: number, to: number, duration: number, gain: number, delay = 0): Layer =>
  tone("sine", from, to, duration, gain, { sweep: duration * 0.45, delay });
/** 爆風の余韻。低域通過の cutoff を下げながら減衰させる */
const rumble = (from: number, to: number, duration: number, gain: number, delay = 0): Layer =>
  noise("lowpass", from, to, duration, gain, { q: 0.7, attack: 0.004, delay });

const pops = (count: number, spacing: number, from: number): readonly Layer[] => Array.from({ length: count }, (_, i) => [
  crack(0.035, 0.55, i * spacing),
  thump(from * (1 + i * 0.06), 55, 0.16, 0.6, i * spacing),
]).flat();

const WEAPONS: Readonly<Record<WeaponSound, Recipe>> = {
  "laser-fire": { layers: [
    tone("sawtooth", 2600, 240, 0.22, 0.5, { sweep: 0.18, lowpass: 7000 }),
    tone("square", 1300, 160, 0.18, 0.22),
    noise("highpass", 6500, 3000, 0.06, 0.45),
    thump(140, 60, 0.12, 0.55),
  ], space: 0.2, vary: 0.04 },
  "laser-impact": { layers: [
    noise("bandpass", 4200, 1400, 0.12, 0.6, { q: 1.8 }),
    tone("triangle", 1000, 140, 0.12, 0.3),
    thump(130, 55, 0.12, 0.45),
  ], drive: 1.5, duck: 0.08, vary: 0.08 },
  "floater-fire": { layers: [
    tone("sine", 150, 620, 0.36, 0.55, { attack: 0.01 }),
    tone("triangle", 300, 1240, 0.3, 0.12, { delay: 0.02 }),
    noise("bandpass", 280, 1100, 0.34, 0.35, { q: 1, attack: 0.03 }),
  ], space: 0.25, vary: 0.04 },
  "floater-impact": { layers: [
    tone("sine", 520, 70, 0.4, 0.55, { sweep: 0.2 }),
    thump(95, 32, 0.7, 0.9),
    rumble(1800, 140, 0.9, 0.75),
    noise("bandpass", 2400, 900, 0.35, 0.18, { q: 2, delay: 0.04 }),
  ], drive: 1.8, space: 0.45, duck: 0.4, vary: 0.05 },
  "triple-fire": { layers: [...pops(3, 0.055, 200), rumble(2600, 400, 0.35, 0.35)], drive: 2, space: 0.2, duck: 0.15, vary: 0.04 },
  "triple-impact": { layers: [
    crack(0.045, 0.65),
    thump(130, 40, 0.45, 0.85),
    rumble(2600, 150, 0.6, 0.7),
  ], drive: 2, space: 0.3, duck: 0.25, vary: 0.06 },
  "multiple-fire": { layers: [
    ...[0, 0.07, 0.14].flatMap((delay) => [tone("square", 950, 210, 0.05, 0.18, { delay }), noise("highpass", 3200, 2000, 0.03, 0.45, { delay })]),
    thump(170, 70, 0.2, 0.45),
  ], drive: 1.6, space: 0.15, vary: 0.05 },
  "multiple-impact": { layers: [
    noise("bandpass", 2600, 800, 0.12, 0.55, { q: 1.2 }),
    thump(220, 70, 0.12, 0.45),
  ], drive: 1.6, duck: 0.06, vary: 0.1 },
  "drill-fire": { layers: [
    crack(0.05, 0.55),
    thump(150, 45, 0.28, 0.85),
    tone("sawtooth", 120, 78, 0.34, 0.24, { lowpass: 900, attack: 0.01 }),
    tone("sawtooth", 126, 80, 0.34, 0.18, { lowpass: 900, attack: 0.01 }),
  ], drive: 2.2, space: 0.2, duck: 0.2, vary: 0.04 },
  "drill-impact": { layers: [
    tone("sawtooth", 190, 55, 0.36, 0.3, { lowpass: 1300 }),
    noise("bandpass", 1600, 450, 0.36, 0.55, { q: 1.4 }),
    thump(105, 38, 0.34, 0.8),
  ], drive: 2.4, space: 0.25, duck: 0.25, vary: 0.06 },
  "digger-fire": { layers: [
    thump(210, 70, 0.22, 0.8),
    rumble(1300, 400, 0.18, 0.45),
    noise("highpass", 6200, 5200, 0.34, 0.1, { delay: 0.05, attack: 0.03 }),
  ], drive: 1.8, space: 0.2, duck: 0.15, vary: 0.04 },
  "digger-impact": { layers: [
    crack(0.06, 0.55),
    thump(82, 26, 1.2, 1),
    rumble(1600, 60, 1.6, 1),
    noise("bandpass", 850, 280, 0.9, 0.4, { q: 1, delay: 0.08, attack: 0.02 }),
  ], drive: 2.2, space: 0.5, duck: 0.55, vary: 0.04 },
  "stinger-fire": { layers: [
    noise("highpass", 7200, 4200, 0.08, 0.8),
    tone("sine", 3200, 900, 0.1, 0.4),
    tone("square", 1600, 420, 0.06, 0.2),
  ], space: 0.15, vary: 0.05 },
  "stinger-impact": { layers: [
    noise("highpass", 3200, 1800, 0.05, 0.85),
    tone("triangle", 1900, 300, 0.09, 0.4),
    thump(170, 55, 0.14, 0.6),
  ], drive: 1.8, space: 0.15, duck: 0.15, vary: 0.05 },
};

export const SOUNDS: Readonly<Record<SoundName, Recipe>> = {
  ...WEAPONS,
  // 履帯の短い噛み合い。75 ms ごとに繰り返すので控えめにする
  move: { layers: [noise("bandpass", 420, 300, 0.04, 0.13, { q: 3 }), tone("triangle", 95, 55, 0.05, 0.09)], vary: 0.12 },
  // 秒読み。繰り返すので鋭さだけ残して小さく
  tick: { layers: [tone("square", 1760, 1760, 0.05, 0.16), tone("sine", 880, 880, 0.08, 0.14)], vary: 0 },
  fire: { layers: [
    crack(0.06, 0.8),
    thump(160, 42, 0.36, 1),
    rumble(3600, 300, 0.42, 0.6),
    tone("square", 230, 110, 0.07, 0.14),
  ], drive: 2, space: 0.25, duck: 0.25, vary: 0.04 },
  explosion: { layers: [
    crack(0.05, 0.75),
    thump(115, 30, 0.75, 1),
    rumble(2600, 110, 1.2, 0.9),
    noise("bandpass", 3000, 1100, 0.5, 0.22, { q: 1.5, delay: 0.05 }),
  ], drive: 2.2, space: 0.4, duck: 0.5, vary: 0.05 },
  // 自機の被弾。金属の鳴りと鈍い衝撃で、下がる向きの音にする
  hit: { layers: [
    tone("square", 540, 470, 0.26, 0.16),
    tone("triangle", 810, 700, 0.32, 0.18),
    thump(190, 60, 0.26, 0.8),
    noise("bandpass", 1200, 700, 0.14, 0.4, { q: 2 }),
  ], drive: 1.8, space: 0.2, duck: 0.3, vary: 0.03 },
  // 自分の弾が相手に入った手応え。上がる向きの短い音で、被弾と区別する
  hitConfirm: { layers: [
    noise("highpass", 5200, 5200, 0.03, 0.4),
    tone("square", 660, 1320, 0.12, 0.35, { sweep: 0.06 }),
    tone("triangle", 1320, 1320, 0.28, 0.4, { delay: 0.06 }),
  ], space: 0.2, vary: 0 },
  // この一撃で HP が尽きた。二段の爆発と、落ちていく電源音
  finish: { layers: [
    crack(0.08, 0.85),
    thump(95, 26, 1.4, 1),
    rumble(3000, 70, 2, 1),
    tone("sawtooth", 440, 50, 1.1, 0.22, { lowpass: 1600 }),
    thump(125, 38, 0.55, 0.7, 0.18),
    rumble(2200, 120, 0.9, 0.5, 0.18),
  ], drive: 2.2, space: 0.5, duck: 0.7, vary: 0.02 },
  // リザルトの入口。勝敗どちらでも使うので、明るすぎない 3 音の上昇にする
  matchFinish: { layers: [
    tone("triangle", 587, 587, 0.5, 0.3),
    tone("triangle", 880, 880, 0.5, 0.28, { delay: 0.1 }),
    tone("triangle", 1175, 1175, 0.8, 0.26, { delay: 0.2 }),
    thump(110, 55, 0.8, 0.5),
    noise("highpass", 6000, 8000, 0.7, 0.07, { attack: 0.1 }),
  ], space: 0.4, vary: 0 },
};
