// 段丘：A のドリアン、120 BPM。段を上り下りするアルペジオで、盆地へ下りていく曲。
import { arp, beat, concat, phrase } from "../score.mjs";
import { at, chords, downbeat, low, perBar } from "./common.mjs";

const PROGRESSION = [
  "Am7", "D", "Am7", "D", "Am7", "D", "Em7", "G", // A：ドリアンの IV を揺らす
  "Fmaj7", "G", "Am7", "Em7", "Fmaj7", "G", "Am7", "E", // B：旋律を持ち上げ、最後に長和音で張る
  "Dm7", "Em7", "Fmaj7", "G", // C：和音ごとに一段ずつ上がる
  "Am7", "D", "Em7", "G", // D：動機を戻す
];
const VOICING = {
  Am7: "A3+C4+E4+G4", D: "A3+D4+F#4", Em7: "G3+B3+D4+E4", G: "G3+B3+D4",
  Fmaj7: "F3+A3+C4+E4", E: "G#3+B3+E4", Dm7: "A3+C4+D4+F4",
};

const MOTIF = "A4/2 E4/2 A4/4 C5/3 B4/1 G4/2 A4/2";
const REST = "-/16";
const ANSWER = [MOTIF, "F#4/6 E4/2 D4/4 A4/4", "G4/2 E4/2 G4/4 B4/3 A4/1 G4/4", "D5/6 C5/2 B4/4 G4/4"];
const RISE = ["E5/4 C5/2 A4/2 F4/6 G4/2", "B4/4 D5/2 G4/2 B4/8", "C5/2 B4/2 A4/2 G4/2 E4/4 G4/2 A4/2"];
const LEAD = [
  REST, REST, REST, REST, ...ANSWER,
  ...RISE, "B4/6 A4/2 G4/4 E4/4", ...RISE, "G#4/4 B4/4 E5/8",
  REST, REST, REST, REST, ...ANSWER,
].map(phrase);
const STEPS = phrase("F4/4 A4/4 D5/8 G4/4 B4/4 E5/8 A4/4 C5/4 F5/8 B4/4 D5/4 G5/8");

const bounce = (r) => `${low(r)}/3 ${low(r)}/3 ${low(r, 1)}/2 ${low(r)}/2 ${low(r)}/3 ${low(r, 1)}/3`;
const bassLine = perBar(PROGRESSION, bounce);
const pads = chords(PROGRESSION, VOICING);
const chordText = PROGRESSION.map((s) => `${VOICING[s]}/16`).join(" ");
const upstairs = arp(chordText, [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6]);
const downstairs = arp(chordText, [6, 5, 4, 3, 5, 4, 3, 2, 4, 3, 2, 1, 3, 2, 1, 0]);

const KICK = beat("X.....x...X..x..");
const KICK_TONE = { tone: 52, decay: 0.26 };
const SNARE = { tone: 200, decay: 0.14 };

export default {
  name: "terraces", bpm: 120, bars: 24, seed: 120,
  scale: { tonic: "A", mode: "dorian", allow: ["G#", "F"] }, // B と C は自然短音階の F を借りる
  duck: { depth: 0.3, release: 0.1 },
  echo: { steps: 3, feedback: 0.36, gain: 0.45 },
  space: { room: 0.75, damp: 0.4, gain: 0.85 },
  layers: [
    { inst: "kick", part: KICK, to: 16, level: -17.5, params: KICK_TONE },
    { inst: "kick", part: beat("X.......X......."), from: 16, to: 20, level: -20, params: KICK_TONE },
    { inst: "kick", part: KICK, from: 20, level: -17.5, params: KICK_TONE },
    { inst: "snare", part: beat("....X.......X..."), from: 4, level: -20, reverb: 0.25, params: SNARE },
    { inst: "clap", part: beat("....x.......x..."), from: 8, to: 16, level: -24, reverb: 0.3, pan: 0.15 },
    at(15, { inst: "snare", part: beat("........x.xXrrrr"), level: -21, reverb: 0.25, params: SNARE }),
    at(23, { inst: "snare", part: beat("........x.xXrrrr"), level: -21, reverb: 0.25, params: SNARE }),
    { inst: "hat", part: beat("xgxgxgxgxgxgxgxg"), level: -26, humanize: 0.2, pan: [0.3, 0.2] },
    { inst: "hat", part: beat("..............x."), from: 4, level: -28, pan: -0.25, params: { decay: 0.2 } },
    { inst: "rim", part: beat("..x.......x..x.."), from: 16, to: 20, level: -28, delay: 0.3, pan: -0.4 },
    ...[0, 8, 12, 20].map((bar) => at(bar, { inst: "crash", part: downbeat(), level: -26, reverb: 0.3, pan: 0.3 })),
    { inst: "bass", part: bassLine, level: -18, legato: 0.75, params: { cutoff: 240, sweep: 1500, drive: 1.6 } },
    { inst: "pad", part: pads, level: -23, reverb: 0.5, legato: 1, params: { cutoff: 1300 } },
    { inst: "pluck", part: upstairs, to: 8, level: -24, delay: 0.35, pan: [-0.4, 0.4], params: { bright: 3200 } },
    { inst: "pluck", part: downstairs, from: 8, to: 16, level: -24, delay: 0.35, pan: [0.4, -0.4] },
    { inst: "pluck", part: upstairs, from: 16, level: -23, delay: 0.35, pan: [-0.4, 0.4] },
    { inst: "lead", part: concat(...LEAD), level: -18.5, delay: 0.3, reverb: 0.3, params: { cutoff: 1600 } },
    { inst: "bell", part: STEPS, from: 16, to: 20, level: -20, delay: 0.4, reverb: 0.4, params: { ratio: 2, index: 1.6, decay: 0.9 } },
  ],
};
