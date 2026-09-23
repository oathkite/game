// 稜線：主題曲。D の自然短音階、126 BPM。夜の稜線を進む行軍の刻み。
import { arp, beat, concat, phrase, transpose } from "../score.mjs";
import { at, chords, downbeat, hold, low, perBar } from "./common.mjs";

const PROGRESSION = [
  "Dm", "Dm", "Bb", "C", "Dm", "Dm", "Bb", "C", // A：刻みだけで始め、後半で動機を出す
  "Gm", "Bb", "Dm", "A", "Gm", "Bb", "Dm", "A", // B：旋律を持ち上げ、属和音で張る
  "Bb", "C", "Am", "Dm", // C：打楽器を太鼓に替えて一度沈む
  "Dm", "Bb", "Gm", "A", // D：動機をオクターブ上で戻し、先頭へ解決する
];
const VOICING = { Dm: "A3+D4+F4", Bb: "Bb3+D4+F4", C: "G3+C4+E4", Gm: "G3+Bb3+D4", A: "A3+C#4+E4", Am: "A3+C4+E4" };

export const MOTIF = "D4/2 A3/2 D4/4 F4/3 E4/1 C4/2 D4/2";
const REST = "-/16";
const LEAD = [
  REST, REST, REST, REST,
  MOTIF, "A4/6 G4/2 F4/4 E4/4", "D4/2 Bb3/2 D4/4 F4/3 G4/1 A4/4", "G4/6 F4/2 E4/4 C4/4",
  "Bb4/4 A4/2 G4/2 D5/6 C5/2", "Bb4/4 A4/2 F4/2 D4/8", "F4/2 E4/2 F4/2 A4/2 D5/4 C5/2 A4/2", "C#5/6 B4/2 A4/4 E4/4",
  "Bb4/4 A4/2 G4/2 D5/6 C5/2", "Bb4/4 A4/2 F4/2 D4/8", "F4/2 E4/2 F4/2 A4/2 D5/4 C5/2 A4/2", "E5/2 C#5/2 A4/2 E4/2 C#4/2 E4/2 A4/4",
  REST, REST, REST, REST, REST, REST, REST, REST,
].map(phrase);
const CLIMAX = ["D4/2 A3/2 D4/4 F4/3 E4/1 C4/2 D4/2", "D4/2 Bb3/2 D4/4 F4/3 G4/1 A4/4", "Bb4/2 A4/2 G4/4 D5/3 C5/1 Bb4/4", "A4/6 C#5/2 E5/4 -/4"].map(phrase);
const BELL = phrase("D5/4 A4/4 D5/8 F5/6 E5/2 C5/4 D5/4 C5/4 A4/4 E5/8 D5/16");

const gallop = (r) => `${low(r)}/2 ${low(r)}/2 ${low(r, 1)}/1 ${low(r)}/1 ${low(r)}/2 ${low(r)}/2 ${low(r)}/2 ${low(r, 1)}/1 ${low(r)}/1 ${low(r)}/2`;
const sustain = (r) => `${low(r)}/6 ${low(r)}/2 ${low(r)}/8`;
const bassLine = concat(
  perBar(PROGRESSION.slice(0, 16), gallop),
  perBar(PROGRESSION.slice(16, 20), sustain),
  perBar(PROGRESSION.slice(20), gallop),
);

const KICK = beat("X.....x.X..x....");
const BACKBEAT = beat("....X.......X...");
const FILL = beat("X..xX..xX.xxrrrr");
const GHOSTS = beat("..g...g...g.g..g");
const HATS = beat("g.xgg.xgg.xgg.xg");
const pads = chords(PROGRESSION, VOICING);
const sparkle = arp(PROGRESSION.map((s) => `${VOICING[s]}/16`).join(" "), [0, 1, 2, 1, 3, 2, 1, 2]);

const snareParams = { tone: 190, decay: 0.16 };
const KICK_TONE = { tone: 50, decay: 0.28 };
export default {
  name: "ridgeline", bpm: 126, bars: 24, seed: 126,
  scale: { tonic: "D", mode: "aeolian", allow: ["C#", "B"] },
  duck: { depth: 0.3, release: 0.1 },
  echo: { steps: 3, feedback: 0.34, gain: 0.45 },
  space: { room: 0.78, damp: 0.45, gain: 0.9 },
  layers: [
    { inst: "kick", part: KICK, to: 16, level: -17, params: KICK_TONE },
    { inst: "kick", part: downbeat(), from: 16, to: 20, level: -21, params: KICK_TONE },
    { inst: "kick", part: KICK, from: 20, level: -17, params: KICK_TONE },
    { inst: "snare", part: BACKBEAT, from: 4, to: 15, level: -20, reverb: 0.25, params: snareParams },
    { inst: "snare", part: BACKBEAT, from: 20, to: 23, level: -20, reverb: 0.25, params: snareParams },
    at(15, { inst: "snare", part: FILL, level: -19, reverb: 0.25, params: snareParams }),
    at(23, { inst: "snare", part: FILL, level: -19, reverb: 0.25, params: snareParams }),
    { inst: "snare", part: GHOSTS, from: 8, to: 16, level: -28, params: { tone: 240, decay: 0.08 } },
    { inst: "snare", part: GHOSTS, from: 20, level: -28, params: { tone: 240, decay: 0.08 } },
    { inst: "hat", part: HATS, to: 16, level: -25, humanize: 0.15, pan: [0.25, 0.15] },
    { inst: "hat", part: HATS, from: 20, level: -25, humanize: 0.15, pan: [0.25, 0.15] },
    { inst: "shaker", part: beat("xgxgxgxgxgxgxgxg"), from: 16, to: 20, level: -28, pan: -0.2 },
    { inst: "tom", part: beat("X.......x......."), from: 16, to: 20, level: -19, reverb: 0.4, params: { tone: 72, decay: 0.5 } },
    { inst: "tom", part: beat("......x...x.x..."), from: 16, to: 20, level: -22, reverb: 0.4, pan: 0.3, params: { tone: 118 } },
    ...[0, 4, 8, 12, 20].map((bar) => at(bar, { inst: "crash", part: downbeat(), level: -25, reverb: 0.3, pan: -0.3 })),
    at(19, { inst: "sweep", part: hold(16, 0.5), level: -26, reverb: 0.4 }),
    { inst: "bass", part: bassLine, level: -17.5, legato: 0.8 },
    { inst: "pad", part: pads, level: -22, reverb: 0.5, legato: 1, params: { cutoff: 1100 } },
    { inst: "pluck", part: sparkle, to: 8, level: -27, delay: 0.4, pan: [-0.5, 0.5], params: { bright: 2500 } },
    { inst: "pluck", part: sparkle, from: 8, level: -24, delay: 0.4, reverb: 0.2, pan: [-0.5, 0.5] },
    { inst: "lead", part: concat(...LEAD), level: -18.5, delay: 0.3, reverb: 0.35 },
    { inst: "lead", part: transpose(concat(...CLIMAX), 12), from: 20, level: -19, delay: 0.3, reverb: 0.35, params: { cutoff: 1300 } },
    { inst: "bell", part: BELL, from: 16, to: 20, level: -21, delay: 0.5, reverb: 0.5 },
  ],
};
