// 浮島：E の自然短音階、98 BPM。高い音域のガラスの鐘と広いパッドで、宙に浮いた足場を渡る。
import { arp, beat, concat, phrase } from "../score.mjs";
import { at, chords, downbeat, hold, low, perBar } from "./common.mjs";

const PROGRESSION = [
  "Em9", "Cmaj7", "Em9", "Cmaj7", "Em9", "Cmaj7", "Am9", "B", // A：鐘とパッドだけで浮かぶ
  "Cmaj7", "D", "Bm7", "Em9", "Cmaj7", "D", "Am9", "B", // B：旋律を高く、属和音で次へ渡す
  "Cmaj7", "Cmaj7", "Am9", "B", // C：打楽器を抜いて漂う
];
const VOICING = {
  Em9: "G3+B3+D4+F#4", Cmaj7: "G3+B3+C4+E4", Am9: "A3+C4+G4+B4", B: "F#3+B3+D#4",
  D: "F#3+A3+D4", Bm7: "F#3+A3+B3+D4",
};

const MOTIF = "E5/2 B4/2 E5/4 G5/3 F#5/1 D5/2 E5/2";
const REST = "-/16";
const LEAD = [
  REST, REST, REST, REST,
  MOTIF, "B4/6 C5/2 E5/8", "E5/2 C5/2 E5/4 G5/3 F#5/1 E5/4", "F#5/8 D#5/8",
  "G5/4 E5/2 C5/2 B4/8", "A4/4 D5/2 F#5/2 A5/8", "F#5/6 E5/2 D5/4 B4/4", "E5/16",
  "G5/4 E5/2 C5/2 B4/8", "A4/4 D5/2 F#5/2 A5/8", "G5/6 E5/2 C5/4 B4/4", "D#5/6 F#5/2 B5/8",
  REST, REST, REST, REST,
].map(phrase);
const DRIFT = phrase("E5/8 B4/8 G5/12 F#5/4 E5/8 C5/8 B4/16");

const float = (r) => `${low(r)}/14 ${low(r, 1)}/2`;
const bassLine = perBar(PROGRESSION, float);
const pads = chords(PROGRESSION, VOICING);
const glass = arp(PROGRESSION.map((s) => `${VOICING[s]}/16`).join(" "), [4, 6, 5, 7, 6, 8, 7, 5], 2);

const GLASS = { ratio: 2, index: 1.4, fall: 0.5, decay: 1.3 };
const KICK_TONE = { tone: 48, decay: 0.4, drive: 1.5 };

export default {
  name: "sky-islands", bpm: 98, bars: 20, seed: 98,
  scale: { tonic: "E", mode: "aeolian", allow: ["D#"] },
  duck: { depth: 0.2, release: 0.18 },
  echo: { steps: 6, feedback: 0.45, tone: 0.25, gain: 0.55 },
  space: { room: 0.92, damp: 0.25, gain: 1.1 },
  layers: [
    { inst: "shaker", part: beat("xgxgxgxgxgxgxgxg"), level: -29, humanize: 0.25, pan: [-0.3, 0.3] },
    { inst: "kick", part: beat("X.........x....."), from: 4, to: 16, level: -19, params: KICK_TONE },
    { inst: "clap", part: beat("........X......."), from: 4, to: 16, level: -22, reverb: 0.7, params: { tone: 1200, decay: 0.2 } },
    { inst: "rim", part: beat("......x.......x."), from: 8, to: 16, level: -29, delay: 0.5, pan: 0.5, params: { tone: 2200 } },
    { inst: "hat", part: beat("..x...x...x...x."), from: 8, to: 16, level: -28, pan: -0.2, params: { decay: 0.06 } },
    ...[4, 8, 12].map((bar) => at(bar, { inst: "crash", part: downbeat(0.8), level: -27, reverb: 0.6, params: { decay: 2.2 } })),
    at(3, { inst: "sweep", part: hold(16, 0.4), level: -28, reverb: 0.6, params: { from: 400, to: 9000 } }),
    at(19, { inst: "sweep", part: hold(16, 0.4), level: -28, reverb: 0.6, params: { from: 400, to: 9000 } }),
    { inst: "bass", part: bassLine, from: 4, level: -20, legato: 0.95, params: { cutoff: 140, sweep: 350, drive: 1.2, sub: 0.8 } },
    { inst: "pad", part: pads, level: -21, reverb: 0.7, legato: 1, params: { cutoff: 1800, attack: 1.4, release: 1.6, detune: 12 } },
    { inst: "bell", part: glass, level: -22, delay: 0.6, reverb: 0.6, pan: [-0.6, 0.6], params: GLASS },
    { inst: "lead", part: concat(...LEAD), level: -20, delay: 0.45, reverb: 0.55, params: { cutoff: 1500, bright: 1200, vibrato: 0.008, drive: 1.1 } },
    { inst: "bell", part: DRIFT, from: 16, level: -21, delay: 0.6, reverb: 0.7, params: { ...GLASS, decay: 2 } },
  ],
};
