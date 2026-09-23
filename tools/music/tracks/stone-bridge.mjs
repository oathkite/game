// 石橋：E のフリジアン、105 BPM。底の抜けた石のアーチを渡る、重く張り詰めた曲。
import { arp, beat, concat, phrase } from "../score.mjs";
import { at, chords, downbeat, hold, low, perBar } from "./common.mjs";

const PROGRESSION = [
  "Em", "Em", "F", "Em", "Em", "Em", "F", "G", // A：太鼓と持続音だけで始め、後半で動機を低く出す
  "Am", "G", "F", "E", "Am", "G", "F", "E", // B：半音下がる進行で E の長和音へ落とす
  "Em", "F", "Em", "F", // C：鐘と金属音だけの谷
];
const VOICING = { Em: "G3+B3+E4", F: "A3+C4+F4", G: "G3+B3+D4", Am: "A3+C4+E4", E: "G#3+B3+E4" };

const MOTIF = "E4/2 B3/2 E4/4 G4/3 F4/1 D4/2 E4/2";
const REST = "-/16";
const LEAD = [
  REST, REST, REST, REST,
  MOTIF, "B4/6 A4/2 G4/4 F4/4", "F4/2 C4/2 F4/4 A4/3 G4/1 F4/4", "G4/6 F4/2 E4/4 D4/4",
  "C5/4 B4/2 A4/2 E5/6 D5/2", "D5/4 B4/2 G4/2 D5/8", "C5/2 A4/2 F4/2 A4/2 C5/4 B4/2 A4/2", "G#4/6 A4/2 B4/4 E5/4",
  "C5/4 B4/2 A4/2 E5/6 D5/2", "D5/4 B4/2 G4/2 D5/8", "C5/2 A4/2 F4/2 A4/2 C5/4 B4/2 A4/2", "E5/2 D5/2 C5/2 B4/2 A4/2 G#4/2 B4/4",
  REST, REST, REST, REST,
].map(phrase);
const BELL = phrase("E5/4 B4/4 E5/8 F5/6 E5/2 C5/4 B4/4 E5/4 B4/4 G5/8 F5/16");

/** 半音上の F へ触れて戻るフリジアンの刻み */
const riff = (r, symbol) => {
  if (symbol === "Em") return "E2/3 E2/3 F2/2 E2/3 E2/3 G2/2";
  if (symbol === "F") return "F2/3 F2/3 G2/2 F2/3 F2/3 E2/2";
  return `${low(r)}/3 ${low(r)}/3 ${low(r, 1)}/2 ${low(r)}/3 ${low(r)}/3 ${low(r)}/2`;
};
const bassLine = perBar(PROGRESSION, riff);
const DRONE = phrase("E2/64");
const pads = chords(PROGRESSION, VOICING);
const glints = arp(PROGRESSION.map((s) => `${VOICING[s]}/16`).join(" "), [0, 2, 1, 3, null, 2, 1, null], 2);

const TAIKO = { tone: 62, decay: 0.6, thump: 0.6, drive: 1.8 };
const HIGH_TAIKO = { tone: 96, decay: 0.4, thump: 0.5 };
const CLANK = { tone: 420, ratio: 1.414, index: 5, decay: 0.18 };
const SNARE = { tone: 170, decay: 0.24, snap: 1800 };
const KICK_TONE = { tone: 46, decay: 0.34 };

export default {
  name: "stone-bridge", bpm: 105, bars: 20, seed: 105,
  scale: { tonic: "E", mode: "phrygian", allow: ["G#"] },
  duck: { depth: 0.25, release: 0.14 },
  echo: { steps: 6, feedback: 0.3, tone: 0.45, gain: 0.4 },
  space: { room: 0.9, damp: 0.5, gain: 1 },
  layers: [
    { inst: "tom", part: beat("X.....X...X....."), level: -19, reverb: 0.5, params: TAIKO },
    { inst: "tom", part: beat("......x.....x.x."), to: 16, level: -23, reverb: 0.5, pan: 0.35, params: HIGH_TAIKO },
    { inst: "tom", part: beat("..x...x...x.x..x"), from: 16, level: -23, reverb: 0.5, pan: 0.35, params: HIGH_TAIKO },
    at(7, { inst: "tom", part: beat("........x.x.rrrr"), level: -22, reverb: 0.4, pan: -0.3, params: HIGH_TAIKO }),
    at(15, { inst: "tom", part: beat("........x.x.rrrr"), level: -22, reverb: 0.4, pan: -0.3, params: HIGH_TAIKO }),
    { inst: "kick", part: beat("X.......X..x...."), from: 4, to: 16, level: -19, params: KICK_TONE },
    { inst: "snare", part: beat("........X......."), from: 4, to: 16, level: -20, reverb: 0.6, params: SNARE },
    { inst: "hat", part: beat("x.x.x.x.x.x.x.x."), from: 8, to: 16, level: -28, humanize: 0.2, pan: 0.2 },
    { inst: "metal", part: beat("...x.......x...."), to: 16, level: -29, reverb: 0.4, delay: 0.3, pan: [-0.5, 0.5], params: CLANK },
    { inst: "metal", part: beat("..x...x...x.x..x"), from: 16, level: -27, reverb: 0.5, delay: 0.4, pan: [-0.6, 0.6], params: CLANK },
    ...[0, 8, 12].map((bar) => at(bar, { inst: "crash", part: downbeat(), level: -26, reverb: 0.4, pan: 0.3, params: { decay: 1.8 } })),
    at(19, { inst: "sweep", part: hold(16, 0.5), level: -27, reverb: 0.5, params: { from: 200, to: 4000 } }),
    { inst: "drone", part: DRONE, level: -24, reverb: 0.3 },
    { inst: "bass", part: bassLine, to: 16, level: -18, legato: 0.7, params: { cutoff: 160, sweep: 900, drive: 2.6 } },
    { inst: "bass", part: bassLine, from: 16, level: -22, legato: 0.7, params: { cutoff: 140, sweep: 400, drive: 2 } },
    { inst: "pad", part: pads, from: 4, level: -24, reverb: 0.6, legato: 1, params: { cutoff: 800, attack: 1.2 } },
    { inst: "pluck", part: glints, from: 8, to: 16, level: -27, delay: 0.5, reverb: 0.3, pan: [-0.6, 0.6], params: { bright: 1800, width: 0.18 } },
    { inst: "lead", part: concat(...LEAD), level: -19, delay: 0.25, reverb: 0.45, params: { cutoff: 1100, bright: 1500, drive: 2 } },
    { inst: "bell", part: BELL, from: 16, level: -21, delay: 0.5, reverb: 0.6, params: { ratio: 1.414, index: 3, decay: 1.4 } },
  ],
};
