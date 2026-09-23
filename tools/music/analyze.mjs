// 調整用: node tools/music/analyze.mjs <track> で層ごとのラウドネスと帯域の偏りを出す。
import { SR, BP, createBus, createFilter, createRng, mixInto } from "./dsp.mjs";
import { integratedLoudness } from "./loudness.mjs";
import { TRACKS } from "./tracks/index.mjs";
import { mixdown, renderLayer } from "./mixdown.mjs";

const name = process.argv[2];
const track = TRACKS.find((item) => item.name === name);
if (!track) throw new Error(`Unknown track ${name}`);
const frames = SR * 240 / track.bpm * track.bars;
const rng = createRng(track.seed);
for (const layer of track.layers) {
  const bus = createBus(frames);
  renderLayer(bus, layer, track, rng);
  const scaled = createBus(frames); mixInto(scaled, bus, layer.gain ?? 1);
  console.log(`${layer.inst.padEnd(7)} ${String(layer.from ?? 0).padStart(2)}-${String(layer.to ?? track.bars).padEnd(2)} ${integratedLoudness(scaled).toFixed(1)} LUFS`);
}
const { bus } = mixdown(track);
const bands = [40, 80, 160, 320, 640, 1280, 2560, 5120, 10240];
const sections = [];
for (const centre of bands) {
  const filter = createFilter();
  let sum = 0;
  for (let i = 0; i < frames; i++) { const y = filter((bus.L[i] + bus.R[i]) / 2, centre, 1.4, BP); sum += y * y; }
  sections.push(`${centre}Hz ${(10 * Math.log10(sum / frames)).toFixed(1)}`);
}
console.log(sections.join(" | "));
const barFrames = SR * 240 / track.bpm;
const perBar = [];
for (let bar = 0; bar < track.bars; bar++) {
  let sum = 0;
  for (let i = bar * barFrames; i < (bar + 1) * barFrames; i++) sum += bus.L[i] ** 2 + bus.R[i] ** 2;
  perBar.push((10 * Math.log10(sum / barFrames / 2)).toFixed(0));
}
console.log(`bar RMS dB: ${perBar.join(" ")}`);
