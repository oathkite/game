// リザルト：F の長音階に同主短調の iv を混ぜる、84 BPM。勝っても負けても合う、一戦を振り返る曲。
import { beat, concat, phrase } from "../score.mjs";
import { chords, low, perBar } from "./common.mjs";

const PROGRESSION = [
  "Fmaj7", "Am7", "Bbmaj7", "Bbm6", // A：短調の iv で少しだけ苦くする
  "Fmaj7", "Am7", "Gm7", "Csus",
  "Dm7", "Am7", "Bbmaj7", "C", // C：属和音から先頭へ戻る
];
const VOICING = {
  Fmaj7: "F3+A3+C4+E4", Am7: "A3+C4+E4+G4", Bbmaj7: "F3+A3+Bb3+D4", Bbm6: "F3+G3+Bb3+Db4",
  Gm7: "F3+Bb3+D4", Csus: "F3+G3+C4", Dm7: "F3+A3+C4+D4", C: "E3+G3+C4",
};

// 主題の動機を長調に置き換え、音価を倍に伸ばしたもの
const MELODY = phrase([
  "F4/4 C4/4 F4/8", "A4/6 G4/2 E4/8", "F4/4 D4/4 F4/4 A4/4", "Db5/8 C5/8",
  "C5/6 A4/2 F4/8", "E5/6 D5/2 C5/8", "Bb4/6 A4/2 G4/4 F4/4", "G4/16",
  "A4/4 F4/4 A4/4 C5/4", "E5/8 C5/8", "D5/6 C5/2 Bb4/4 A4/4", "G4/8 E4/8",
].join(" "));

const breathe = (r) => `${low(r)}/10 ${low(r)}/2 ${low(r, 1)}/4`;
const bassLine = perBar(PROGRESSION, breathe);
const comp = (_r, symbol) => `${VOICING[symbol]}/6 ${VOICING[symbol]}/10`;
const keysPart = perBar(PROGRESSION, comp);
const pads = chords(PROGRESSION, VOICING);

export default {
  name: "result", bpm: 84, bars: 12, seed: 84,
  scale: { tonic: "F", mode: "ionian", allow: ["Db"] },
  duck: { depth: 0.12, release: 0.15 },
  echo: { steps: 3, feedback: 0.38, tone: 0.35, gain: 0.45 },
  space: { room: 0.85, damp: 0.45, gain: 1 },
  layers: [
    { inst: "kick", part: beat("X.........x....."), from: 4, level: -21, params: { tone: 56, decay: 0.22, drive: 1.3 } },
    { inst: "rim", part: beat("....x.......x..."), from: 4, level: -24, reverb: 0.4, params: { tone: 1500 } },
    { inst: "shaker", part: beat("x.gxx.gxx.gxx.gx"), level: -30, humanize: 0.3, pan: [0.3, -0.3] },
    { inst: "bass", part: bassLine, from: 4, level: -21, legato: 0.9, params: { cutoff: 160, sweep: 350, drive: 1.2, sub: 0.8 } },
    { inst: "keys", part: keysPart, level: -20, delay: 0.2, reverb: 0.4, legato: 0.98, pan: [-0.15, 0.15] },
    { inst: "pad", part: pads, level: -25, reverb: 0.6, legato: 1, params: { cutoff: 900, attack: 1.2 } },
    { inst: "bell", part: MELODY, level: -20, delay: 0.35, reverb: 0.5, params: { ratio: 1, index: 1.2, fall: 0.4, decay: 1.2 } },
    { inst: "lead", part: MELODY, from: 4, level: -23, delay: 0.3, reverb: 0.45, params: { cutoff: 800, bright: 700, vibrato: 0.005, drive: 1 } },
  ],
};
