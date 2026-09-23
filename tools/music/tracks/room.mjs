// 部屋：G の自然短音階、112 BPM。16 分のベースが秒読みのように刻み、開始を待つ曲。
import { arp, beat, concat, phrase } from "../score.mjs";
import { at, chords, downbeat, hold, low, perBar } from "./common.mjs";

const PROGRESSION = [
  "Gm", "Gm", "Eb", "Eb", "Cm", "Cm", "D", "D", // A：2 小節ずつ和音を保って溜める
  "Gm", "Eb", "Cm", "D", "Gm", "Eb", "Cm", "D", // B：1 小節ずつ動かし、動機を出す
];
const VOICING = { Gm: "G3+Bb3+D4", Eb: "G3+Bb3+Eb4", Cm: "G3+C4+Eb4", D: "F#3+A3+D4" };

const MOTIF = "G4/2 D4/2 G4/4 Bb4/3 A4/1 F4/2 G4/2";
const LEAD = [
  ...Array(8).fill("-/16"),
  MOTIF, "Bb4/6 C5/2 G4/8", "Eb5/2 D5/2 C5/4 G4/3 A4/1 Bb4/4", "A4/6 F#4/2 D4/8",
  "G5/2 D5/2 G5/4 Bb5/3 A5/1 F5/2 G5/2", "Bb5/6 C6/2 G5/8", "Eb5/2 D5/2 C5/4 G4/3 A4/1 Bb4/4", "A4/4 D5/4 F#5/8",
].map(phrase);

/** 拍の頭だけ強い 16 分の刻み */
const tick = (r) => Array.from({ length: 16 }, (_, i) => `${i % 8 === 6 ? low(r, 1) : low(r)}/1${i % 4 === 0 ? "!" : "?"}`).join(" ");
const bassLine = perBar(PROGRESSION, tick);
const pads = chords(PROGRESSION, VOICING);
const climb = arp(PROGRESSION.map((s) => `${VOICING[s]}/16`).join(" "), [0, 1, 2, 3], 2);

const KICK_TONE = { tone: 50, decay: 0.26 };
const SNARE = { tone: 195, decay: 0.15 };
const TOMS = { tone: 105, decay: 0.3 };

export default {
  name: "room", bpm: 112, bars: 16, seed: 112,
  scale: { tonic: "G", mode: "aeolian", allow: ["F#"] },
  duck: { depth: 0.32, release: 0.1 },
  echo: { steps: 3, feedback: 0.35, gain: 0.45 },
  space: { room: 0.78, damp: 0.45, gain: 0.85 },
  layers: [
    { inst: "kick", part: beat("X.......X......."), to: 8, level: -18, params: KICK_TONE },
    { inst: "kick", part: beat("X...X...X...X..."), from: 8, level: -17, params: KICK_TONE },
    { inst: "snare", part: beat("....X.......X..."), from: 4, to: 15, level: -20, reverb: 0.3, params: SNARE },
    at(7, { inst: "snare", part: beat("....X.......XXrr"), level: -20, reverb: 0.3, params: SNARE }),
    at(15, { inst: "tom", part: beat("X.x.x.xxX.x.rrrr"), level: -20, reverb: 0.3, pan: [-0.3, 0.3], params: TOMS }),
    { inst: "hat", part: beat("xgxgxgxgxgxgxgxg"), level: -26, humanize: 0.2, pan: [0.25, 0.15] },
    { inst: "hat", part: beat("..x...x...x...x."), from: 8, level: -27, pan: -0.3, params: { decay: 0.15 } },
    ...[0, 8, 12].map((bar) => at(bar, { inst: "crash", part: downbeat(), level: -26, reverb: 0.3, pan: -0.3 })),
    at(7, { inst: "sweep", part: hold(16, 0.5), level: -27, reverb: 0.3 }),
    { inst: "bass", part: bassLine, level: -18, legato: 0.8, params: { cutoff: 220, sweep: 1100, decay: 0.08, drive: 1.7 } },
    { inst: "pad", part: pads, level: -23, reverb: 0.5, legato: 1, params: { cutoff: 1200 } },
    { inst: "pluck", part: climb, level: -25, delay: 0.4, pan: [-0.45, 0.45], params: { bright: 3000 } },
    { inst: "lead", part: concat(...LEAD), level: -19, delay: 0.3, reverb: 0.3, params: { cutoff: 1400 } },
  ],
};
