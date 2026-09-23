// 使い方: node tools/music/render.mjs [--only ridgeline,lobby] [--out <dir>]
// 曲を合成して OGG Vorbis に書き出し、loops.json と provenance.json を更新する。
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { SR } from "./dsp.mjs";
import { mixdown } from "./mixdown.mjs";
import { TRACKS } from "./tracks/index.mjs";

const { values } = parseArgs({ options: { only: { type: "string" }, out: { type: "string" } } });
const outDir = resolve(values.out ?? "apps/client/src/assets/music");
const only = values.only?.split(",");
const selected = only ? TRACKS.filter((track) => only.includes(track.name)) : TRACKS;
if (!selected.length) throw new Error(`No track matches ${values.only}`);

const interleave = (bus) => {
  const data = new Float32Array(bus.L.length * 2);
  for (let i = 0; i < bus.L.length; i++) { data[i * 2] = bus.L[i]; data[i * 2 + 1] = bus.R[i]; }
  return Buffer.from(data.buffer);
};

const encode = (bus, file) => {
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", "2", "-i", "pipe:0",
    "-c:a", "libvorbis", "-q:a", "5", "-map_metadata", "-1", "-fflags", "+bitexact", file,
  ], { input: interleave(bus), maxBuffer: 1 << 30 });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${result.stderr}`);
};

const readJson = (file) => { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; } };

mkdirSync(outDir, { recursive: true });
const loops = readJson(resolve(outDir, "loops.json"));
const previous = readJson(resolve(outDir, "provenance.json")).files ?? [];
const files = new Map(previous.map((entry) => [entry.track, entry]));
for (const track of selected) {
  const started = performance.now();
  const { bus, frames, lufs, peakDb } = mixdown(track);
  const file = resolve(outDir, `${track.name}.ogg`);
  encode(bus, file);
  loops[track.name] = { start: 0, end: frames / SR };
  const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
  files.set(track.name, { track: track.name, bpm: track.bpm, bars: track.bars, frames, seed: track.seed, sha256 });
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`${track.name}: ${(frames / SR).toFixed(2)} s, ${lufs.toFixed(1)} LUFS, peak ${peakDb.toFixed(1)} dBFS (${seconds} s)`);
}
const order = TRACKS.map((track) => track.name);
const sorted = (entries) => entries.sort((a, b) => order.indexOf(a.track) - order.indexOf(b.track));
writeFileSync(resolve(outDir, "loops.json"), `${JSON.stringify(Object.fromEntries(order.filter((name) => loops[name]).map((name) => [name, loops[name]])), null, 2)}\n`);
writeFileSync(resolve(outDir, "provenance.json"), `${JSON.stringify({
  source: "Synthesized by tools/music/render.mjs from the scores in tools/music/tracks",
  encoder: "ffmpeg libvorbis -q:a 5",
  files: sorted([...files.values()]),
}, null, 2)}\n`);
