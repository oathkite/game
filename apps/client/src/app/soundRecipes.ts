import type { FrameSkin } from "@game/protocol";
import type { WeaponSound } from "./weaponSounds";
import type { Layer, NoiseLayer, Recipe, ToneLayer } from "./sfx";

// 効果音の設計。発射は「破裂の立ち上がり + 胴の低音 + 爆風のノイズ」、着弾は「サブの低音 + 破裂 + 低域へ沈む余韻」を基本形にする。
// 多段の武器（レーザー 7 段、マルチ 9 発）は 1 回を短く軽くし、連続しても濁らないようにする。

/** 移動の音。足回りのスキンごとに変える（設計書 43） */
export type MoveSound = `move-${FrameSkin}`;

export type SoundName = WeaponSound | MoveSound | "tick" | "fire" | "explosion" | "hit" | "hitConfirm" | "finish" | "matchFinish" | "debris" | "sizzle" | "impactStop" | "destroy";

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

/** 土の雨。帯域通過のノイズの短い粒を 0.15〜1.1 秒に散らし、後ろほど小さく低くする。削れた地形の破片が落ちていく長さに合わせる（設計書 41.14） */
const DEBRIS_GRAINS: readonly Layer[] = Array.from({ length: 12 }, (_, i) => {
  const f = i / 11;
  return noise("bandpass", 2600 - 1500 * f, 2000 - 1200 * f, 0.05, 1 - 0.65 * f, { q: 1.2, delay: 0.15 + 0.95 * f + (i % 3) * 0.013 });
});

/** 演出に合わせて足した音（設計書 41.14）。どれも 39 章の出力経路（圧縮器、BGM を下げる仕組み）を通る */
const SCENE: Readonly<Record<"debris" | "sizzle" | "impactStop" | "destroy", Recipe>> = {
  debris: { layers: DEBRIS_GRAINS, space: 0.2, vary: 0.08 },
  // 焼ける音。赤熱が冷める長さ（約 1.6 秒）で小さく消える
  sizzle: { layers: [
    noise("highpass", 5200, 3600, 1.6, 0.11, { attack: 0.06 }),
    noise("bandpass", 7200, 5200, 1.2, 0.05, { q: 4, delay: 0.1, attack: 0.05 }),
  ], space: 0.1, vary: 0.05 },
  // ヒットストップの 60 ms に置く止めの一撃。破裂の頭とサブの低音で、BGM を深く下げる
  impactStop: { layers: [
    crack(0.03, 0.9),
    thump(90, 28, 0.5, 1),
    noise("lowpass", 900, 120, 0.3, 0.5, { q: 0.8 }),
  ], drive: 2.4, space: 0.3, duck: 0.8, vary: 0.02 },
  // 撃破の明滅の後の 3 連の爆発（38.3 の C5、260、400、540 ms）に合わせた破裂と、金属の鳴り
  destroy: { layers: [
    ...[0, 0.14, 0.28].flatMap((delay) => [crack(0.05, 0.3, delay), thump(120, 36, 0.32, 0.55, delay)]),
    tone("triangle", 920, 640, 0.6, 0.12, { delay: 0.02 }),
    rumble(2200, 90, 0.9, 0.45, 0.05),
  ], drive: 1.4, space: 0.35, duck: 0.45, vary: 0.03 },
};

/** 移動の音。75 ms ごとに繰り返すので、どれも短く控えめにする（設計書 43） */
const MOVES: Readonly<Record<MoveSound, Recipe>> = {
  // 履帯の短い噛み合い
  "move-tracks": { layers: [noise("bandpass", 420, 300, 0.04, 0.13, { q: 3 }), tone("triangle", 95, 55, 0.05, 0.09)], vary: 0.12 },
  // 大きな履帯の重い噛み合い。低く、板の当たる金属の音を足す
  "move-bigTracks": { layers: [
    noise("bandpass", 300, 200, 0.06, 0.15, { q: 2.5 }),
    tone("triangle", 70, 42, 0.07, 0.11),
    noise("highpass", 2200, 1800, 0.015, 0.05),
  ], vary: 0.1 },
  // タイヤの転がり。噛み合いの無い、柔らかい低いうなり
  "move-wheels": { layers: [noise("lowpass", 260, 180, 0.07, 0.14, { q: 0.7 }), tone("sine", 62, 50, 0.07, 0.07)], vary: 0.08 },
  // 脚の油圧の短い駆動音と、足が着く金属の音
  "move-walker": { layers: [
    tone("square", 180, 240, 0.05, 0.04, { lowpass: 1200 }),
    noise("bandpass", 900, 600, 0.03, 0.1, { q: 4, delay: 0.02 }),
    tone("sine", 110, 50, 0.06, 0.09, { delay: 0.02 }),
  ], vary: 0.1 },
  // 噴射のうなりと風。繰り返しが途切れず続いて聞こえるよう、間隔より少し長く鳴らす
  "move-hover": { layers: [
    tone("sawtooth", 120, 130, 0.09, 0.05, { lowpass: 600, attack: 0.02 }),
    noise("bandpass", 1600, 1800, 0.09, 0.06, { q: 1.5, attack: 0.02 }),
  ], vary: 0.04 },
  // 石の車輪が地面を噛む、ざらついた低い音
  "move-stoneWheels": { layers: [
    noise("bandpass", 220, 160, 0.08, 0.16, { q: 1.2 }),
    noise("highpass", 1800, 1200, 0.05, 0.05),
    tone("triangle", 55, 40, 0.08, 0.1),
  ], vary: 0.12 },
};

export const isMoveSound = (name: SoundName): name is MoveSound => name.startsWith("move-");

export const SOUNDS: Readonly<Record<SoundName, Recipe>> = {
  ...WEAPONS,
  ...SCENE,
  ...MOVES,
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
