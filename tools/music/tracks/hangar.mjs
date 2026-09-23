// ガレージ：D の自然短音階、90 BPM。タイトル、出撃準備、プラクティスの選択で流す、整備中の落ち着いた曲。
import { beat, concat, phrase } from "../score.mjs";
import { low, perBar } from "./common.mjs";

const PROGRESSION = [
  "Dm9", "Bbmaj7", "Gm9", "Asus", "Dm9", "Bbmaj7", "Gm9", "A", // A：電気ピアノの刻みで待機する
  "Bbmaj7", "C", "Dm9", "Dm9", "Bbmaj7", "C", "Gm9", "A", // B：動機を柔らかい旋律で出す
];
const VOICING = {
  Dm9: "F3+A3+C4+E4", Bbmaj7: "Bb3+D4+F4+A4", Gm9: "F3+Bb3+D4+A4", Asus: "G3+A3+D4+E4",
  A: "G3+A3+C#4+E4", C: "G3+C4+E4",
};

const REST = "-/16";
const LEAD = [
  ...Array(8).fill(REST),
  "D4/4 A3/4 D4/8", "F4/6 E4/2 C4/4 D4/4", "A4/8 G4/4 F4/4", "E4/16",
  "D4/4 A3/4 D4/8", "F4/6 E4/2 C4/4 G4/4", "Bb4/8 A4/4 G4/4", "E4/8 C#4/8",
].map(phrase);

/** 付点の刻み。和音を 3 回置いて間を空ける */
const comp = (_r, symbol) => `${VOICING[symbol]}/3 -/3 ${VOICING[symbol]}/2 -/2 ${VOICING[symbol]}/6`;
const walk = (r) => `${low(r)}/6 ${low(r)}/2 ${low(r, 1)}/2 ${low(r)}/6`;
const keysPart = perBar(PROGRESSION, comp);
const bassLine = perBar(PROGRESSION, walk);
const TELEMETRY = phrase("-/7 A5/1 -/8 -/11 D6/1 -/4 -/3 E6/1 -/12 -/16");

export default {
  name: "hangar", bpm: 90, bars: 16, seed: 90,
  scale: { tonic: "D", mode: "aeolian", allow: ["C#"] },
  duck: { depth: 0.18, release: 0.12 },
  echo: { steps: 3, feedback: 0.4, tone: 0.35, gain: 0.5 },
  space: { room: 0.72, damp: 0.5, gain: 0.8 },
  layers: [
    { inst: "kick", part: beat("X.........X....."), level: -19, params: { tone: 54, decay: 0.24, drive: 1.4 } },
    { inst: "kick", part: beat(".......x........"), from: 8, level: -24, params: { tone: 54, decay: 0.2, drive: 1.4 } },
    { inst: "rim", part: beat("....x.......x..."), level: -22, reverb: 0.3, params: { tone: 1650 } },
    { inst: "hat", part: beat("..x...x...x...x."), level: -27, humanize: 0.2, pan: 0.25, params: { decay: 0.03 } },
    { inst: "shaker", part: beat(".gxg.gxg.gxg.gxg"), from: 8, level: -30, pan: -0.3 },
    { inst: "bass", part: bassLine, level: -19, legato: 0.85, params: { cutoff: 170, sweep: 600, drive: 1.3, sub: 0.7 } },
    { inst: "keys", part: keysPart, level: -20, delay: 0.25, reverb: 0.35, legato: 0.95, pan: [-0.2, 0.2] },
    { inst: "pad", part: perBar(PROGRESSION, (_r, symbol) => `${VOICING[symbol]}/16`), from: 8, level: -26, reverb: 0.6, legato: 1, params: { cutoff: 900, attack: 1 } },
    { inst: "bell", part: TELEMETRY, from: 4, level: -27, delay: 0.6, reverb: 0.4, pan: [0.5, -0.5, 0.3], params: { ratio: 1, index: 0.6, fall: 0.05, decay: 0.12 } },
    { inst: "lead", part: concat(...LEAD), level: -20, delay: 0.35, reverb: 0.4, params: { cutoff: 900, bright: 900, vibrato: 0.004, drive: 1.1 } },
  ],
};
