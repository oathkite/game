// ロビー：C の自然短音階、100 BPM。探信音が回り、入れる部屋を探す待機の曲。
import { arp, beat, concat, phrase } from "../score.mjs";
import { chords, low, perBar } from "./common.mjs";

const PROGRESSION = [
  "Cm9", "Abmaj7", "Fm9", "Gsus", "Cm9", "Abmaj7", "Fm9", "G", // A：刻みと探信音
  "Abmaj7", "Bb", "Cm9", "Cm9", "Abmaj7", "Bb", "Fm9", "G", // B：動機を撥弦の旋律で出す
];
const VOICING = {
  Cm9: "Eb3+G3+Bb3+D4", Abmaj7: "Eb3+G3+Ab3+C4", Fm9: "Eb3+Ab3+C4+G4", Gsus: "F3+G3+C4+D4",
  G: "F3+G3+B3+D4", Bb: "F3+Bb3+D4",
};

const MOTIF = "C5/2 G4/2 C5/4 Eb5/3 D5/1 Bb4/2 C5/2";
const LEAD = [
  ...Array(8).fill("-/16"),
  "C5/6 Bb4/2 G4/4 Eb4/4", "D4/4 F4/4 Bb4/8", MOTIF, "G4/6 Bb4/2 D5/8",
  "Eb5/6 D5/2 C5/4 G4/4", "F4/4 Bb4/4 D5/8", "C5/6 Ab4/2 G4/4 F4/4", "B4/8 D5/4 G4/4",
].map(phrase);

const pulse = (r) => `${low(r)}/2 ${low(r)}/2 ${low(r)}/2 ${low(r, 1)}/2 ${low(r)}/2 ${low(r)}/2 ${low(r)}/2 ${low(r)}/2`;
const bassLine = perBar(PROGRESSION, pulse);
const pads = chords(PROGRESSION, VOICING);
const scan = arp(PROGRESSION.map((s) => `${VOICING[s]}/16`).join(" "), [4, 5, 6, 7, 6, 5], 2);
const PING = phrase("G5/32");

const KICK_TONE = { tone: 50, decay: 0.28 };

export default {
  name: "lobby", bpm: 100, bars: 16, seed: 100,
  scale: { tonic: "C", mode: "aeolian", allow: ["B"] },
  duck: { depth: 0.25, release: 0.12 },
  echo: { steps: 4, feedback: 0.42, tone: 0.3, gain: 0.5 },
  space: { room: 0.85, damp: 0.4, gain: 0.95 },
  layers: [
    { inst: "kick", part: beat("X.....x.X......."), level: -18, params: KICK_TONE },
    { inst: "clap", part: beat("....x.......x..."), from: 4, level: -23, reverb: 0.4, params: { tone: 1300 } },
    { inst: "hat", part: beat("gxgxgxgxgxgxgxgx"), level: -27, humanize: 0.2, pan: [0.3, 0.15] },
    { inst: "rim", part: beat("...x......x....."), from: 8, level: -28, delay: 0.4, pan: -0.4, params: { tone: 1900 } },
    { inst: "sonar", part: PING, level: -22, delay: 0.5, reverb: 0.8, pan: -0.2 },
    { inst: "bass", part: bassLine, level: -18.5, legato: 0.7, params: { cutoff: 190, sweep: 900, drive: 1.5 } },
    { inst: "pad", part: pads, level: -23, reverb: 0.6, legato: 1, params: { cutoff: 1000, attack: 0.9 } },
    { inst: "pluck", part: scan, from: 4, level: -25, delay: 0.45, reverb: 0.2, pan: [-0.5, 0.5], params: { bright: 2800, width: 0.3 } },
    { inst: "lead", part: concat(...LEAD), level: -19.5, delay: 0.35, reverb: 0.35, params: { cutoff: 1300, bright: 1600 } },
  ],
};
