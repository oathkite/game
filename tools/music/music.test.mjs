import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SR, midi } from "./dsp.mjs";
import { integratedLoudness, samplePeakDb } from "./loudness.mjs";
import { CEILING_DB, TARGET_LUFS, expand, loopFrames, mixdown } from "./mixdown.mjs";
import { arp, beat, phrase } from "./score.mjs";
import { TRACKS } from "./tracks/index.mjs";

const MUSIC_DIR = new URL("../../apps/client/src/assets/music/", import.meta.url);

test("phrase reads notes, chords, rests and accents in 16th steps", () => {
  const part = phrase("D4/2 A3+E4/4! -/2 C4/8?");
  assert.equal(part.steps, 16);
  assert.deepEqual(part.events.map((e) => [e.step, e.steps, e.notes, e.vel]), [
    [0, 2, [62], 0.8], [2, 4, [57, 64], 1], [8, 8, [60], 0.55],
  ]);
  assert.throws(() => phrase("D4"), /Unreadable/);
  assert.throws(() => phrase("H4/2"), /Unknown note/);
});

test("beat maps hits per step and splits rolls into 32nd notes", () => {
  const part = beat("X.g. r...|....");
  assert.equal(part.steps, 12);
  assert.deepEqual(part.events.map((e) => [e.step, e.vel]), [[0, 1], [2, 0.35], [4, 0.5], [4.5, 0.42]]);
  assert.throws(() => beat("x?"), /Unknown hit/);
});

test("arp climbs past the chord into the next octave and honours rests", () => {
  const part = arp("C4+E4+G4/4", [0, 3, null, 2], 1);
  assert.deepEqual(part.events.map((e) => e.notes[0]), [60, 72, 67]);
});

test("a layer that starts mid-song stays aligned to the song's bars", () => {
  const part = phrase("C4/16 D4/16 E4/16 F4/16");
  const hits = expand({ part, from: 2, to: 4 }, 4);
  assert.deepEqual(hits.map((h) => [h.step, h.notes[0]]), [[32, midi("E4")], [48, midi("F4")]]);
});

test("loops end on a whole sample and reject tempos that would round", () => {
  assert.throws(() => loopFrames({ name: "x", bpm: 110, bars: 4 }), /whole-sample/);
  for (const track of TRACKS) assert.ok(Number.isInteger(loopFrames(track)), track.name);
});

const MODES = { aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], ionian: [0, 2, 4, 5, 7, 9, 11] };
const pitchClass = (name) => midi(`${name}4`) % 12;

test("every pitched note belongs to its track's declared scale", () => {
  for (const track of TRACKS) {
    const tonic = pitchClass(track.scale.tonic);
    const allowed = new Set([...MODES[track.scale.mode].map((step) => (tonic + step) % 12), ...(track.scale.allow ?? []).map(pitchClass)]);
    for (const layer of track.layers) {
      for (const hit of expand(layer, track.bars)) {
        for (const note of hit.notes) assert.ok(allowed.has(note % 12), `${track.name} ${layer.inst} step ${hit.step} note ${note}`);
      }
    }
  }
});

test("multi-bar parts are whole bars and long ones span the whole song", () => {
  for (const track of TRACKS) {
    for (const layer of track.layers) {
      const { steps } = layer.part;
      assert.equal(steps % 16, 0, `${track.name} ${layer.inst} part is ${steps} steps`);
      if (steps > 64) assert.equal(steps, track.bars * 16, `${track.name} ${layer.inst} part does not span the song`);
    }
  }
});

test("track names match the client's music slots", () => {
  const source = readFileSync(new URL("../../apps/client/src/app/musicTracks.ts", import.meta.url), "utf8");
  const slots = [...source.matchAll(/^\s+'?([a-z-]+)'?: new URL/gm)].map((m) => m[1]);
  assert.deepEqual([...TRACKS.map((t) => t.name)].sort(), slots.sort());
});

const tiny = {
  name: "tiny", bpm: 120, bars: 2, seed: 7, duck: { depth: 0.3 },
  layers: [
    { inst: "kick", part: beat("X...X...X...X..."), level: -18 },
    { inst: "bass", part: phrase("A1/8 E2/8"), level: -18 },
    // 最後の step の長い音。残響の尾がループの先頭へ回り込むかを見る
    { inst: "pad", part: phrase("-/31 A3+C4+E4/1"), level: -20, reverb: 1, legato: 40 },
  ],
};

test("mixdown is deterministic, lands on the loudness target and respects the ceiling", () => {
  const first = mixdown(tiny), second = mixdown(tiny);
  assert.deepEqual(first.bus.L, second.bus.L);
  assert.ok(Math.abs(first.lufs - TARGET_LUFS) < 0.3, `${first.lufs} LUFS`);
  assert.ok(samplePeakDb(first.bus) <= CEILING_DB + 1e-6);
  assert.equal(first.frames, loopFrames(tiny));
});

test("the loop seam is no rougher than the music itself and tails wrap to the start", () => {
  const { bus, frames } = mixdown({ ...tiny, layers: tiny.layers.slice(2) });
  let roughest = 0;
  for (let i = 1; i < frames; i++) roughest = Math.max(roughest, Math.abs(bus.L[i] - bus.L[i - 1]));
  assert.ok(Math.abs(bus.L[0] - bus.L[frames - 1]) <= roughest);
  const head = { L: bus.L.subarray(0, SR / 4), R: bus.R.subarray(0, SR / 4) };
  assert.ok(integratedLoudness(head) > -40, "the pad's tail should be heard at the top of the loop");
});

test("committed music matches its recorded provenance and loop points", () => {
  const provenance = JSON.parse(readFileSync(new URL("provenance.json", MUSIC_DIR), "utf8"));
  const loops = JSON.parse(readFileSync(new URL("loops.json", MUSIC_DIR), "utf8"));
  assert.deepEqual(provenance.files.map((f) => f.track), TRACKS.map((t) => t.name));
  for (const entry of provenance.files) {
    const bytes = readFileSync(new URL(`${entry.track}.ogg`, MUSIC_DIR));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.track);
    const track = TRACKS.find((t) => t.name === entry.track);
    assert.equal(entry.frames, loopFrames(track), entry.track);
    assert.deepEqual(loops[entry.track], { start: 0, end: entry.frames / SR });
  }
});
