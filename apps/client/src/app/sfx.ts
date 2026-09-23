// 効果音のレイヤー合成。1 つの音を、音程の掃引とフィルターを掃引したノイズの重ね合わせで作る。

export type ToneLayer = {
  readonly kind: "tone";
  readonly wave: OscillatorType;
  readonly from: number;
  readonly to: number;
  readonly duration: number;
  readonly gain: number;
  /** 音程の掃引にかける秒。省略すると duration */
  readonly sweep?: number;
  readonly attack?: number;
  readonly delay?: number;
  readonly lowpass?: number;
};

export type NoiseLayer = {
  readonly kind: "noise";
  readonly filter: BiquadFilterType;
  readonly from: number;
  readonly to?: number;
  readonly q?: number;
  readonly duration: number;
  readonly gain: number;
  readonly attack?: number;
  readonly delay?: number;
};

export type Layer = ToneLayer | NoiseLayer;

export type Recipe = {
  readonly layers: readonly Layer[];
  /** 全体に通す歪みの強さ。0 か省略で通さない */
  readonly drive?: number;
  /** 残響へ送る量 */
  readonly space?: number;
  /** BGM を一瞬下げる量。0..1 */
  readonly duck?: number;
  /** 鳴らすたびに音程を揺らす幅。同じ音の連打を機械的に聞かせない */
  readonly vary?: number;
};

export type SfxGraph = {
  readonly ctx: BaseAudioContext;
  readonly output: AudioNode;
  readonly space: AudioNode | null;
  readonly noise: AudioBuffer | null;
};

const SILENT = 0.0001;

const envelope = (param: AudioParam, t: number, attack: number, peak: number, end: number): void => {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(SILENT, end);
};

const layerEnd = (layer: Layer): number => (layer.delay ?? 0) + layer.duration;

const playTone = (graph: SfxGraph, bus: AudioNode, layer: ToneLayer, start: number, rate: number): AudioScheduledSourceNode => {
  const { ctx } = graph;
  const t = start + (layer.delay ?? 0), end = t + layer.duration;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = layer.wave;
  osc.frequency.setValueAtTime(layer.from * rate, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, layer.to * rate), t + (layer.sweep ?? layer.duration));
  envelope(gain.gain, t, layer.attack ?? 0.002, layer.gain, end);
  const cutoff = layer.lowpass;
  const filter = cutoff ? ctx.createBiquadFilter() : null;
  if (filter && cutoff) { filter.type = "lowpass"; filter.frequency.setValueAtTime(cutoff, t); osc.connect(filter).connect(gain); }
  else osc.connect(gain);
  gain.connect(bus);
  osc.onended = () => { osc.disconnect(); filter?.disconnect(); gain.disconnect(); };
  osc.start(t);
  osc.stop(end + 0.05);
  return osc;
};

const playNoise = (graph: SfxGraph, bus: AudioNode, layer: NoiseLayer, start: number, rate: number, random: () => number): AudioScheduledSourceNode | null => {
  const { ctx, noise } = graph;
  if (!noise) return null;
  const t = start + (layer.delay ?? 0), end = t + layer.duration;
  const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
  source.buffer = noise;
  source.loop = true;
  filter.type = layer.filter;
  filter.Q.setValueAtTime(layer.q ?? 0.8, t);
  filter.frequency.setValueAtTime(layer.from * rate, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, (layer.to ?? layer.from) * rate), end);
  envelope(gain.gain, t, layer.attack ?? 0.001, layer.gain, end);
  source.connect(filter).connect(gain).connect(bus);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  source.start(t, random() * noise.duration);
  source.stop(end + 0.05);
  return source;
};

const curves = new Map<number, Float32Array<ArrayBuffer>>();
/** tanh の歪み曲線。強さごとに 1 本だけ作って使い回す */
const driveCurve = (amount: number): Float32Array<ArrayBuffer> => {
  const cached = curves.get(amount);
  if (cached) return cached;
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 511.5 - 1) * amount) / Math.tanh(amount);
  curves.set(amount, curve);
  return curve;
};

/** 音の入口。歪みと残響の送りを通して出力へつなぐ。最後に鳴り終わる層で片付ける */
const createVoiceBus = (graph: SfxGraph, recipe: Recipe): { readonly input: GainNode; readonly release: () => void } => {
  const { ctx, space } = graph;
  const { drive = 0, space: amount = 0 } = recipe;
  const input = ctx.createGain();
  const shaper = drive > 0 ? ctx.createWaveShaper() : null;
  if (shaper) { shaper.curve = driveCurve(drive); shaper.oversample = "2x"; input.connect(shaper).connect(graph.output); }
  else input.connect(graph.output);
  const send = amount > 0 && space ? ctx.createGain() : null;
  if (send && space) { send.gain.value = amount; input.connect(send).connect(space); }
  return { input, release: () => { input.disconnect(); shaper?.disconnect(); send?.disconnect(); } };
};

/** 1 回鳴らす。random は音程の揺れとノイズの読み出し位置に使う */
export const playRecipe = (graph: SfxGraph, recipe: Recipe, start: number, random: () => number = Math.random): void => {
  const rate = 1 + (random() * 2 - 1) * (recipe.vary ?? 0.03);
  const voice = createVoiceBus(graph, recipe);
  let last: { readonly source: AudioScheduledSourceNode; readonly end: number } | null = null;
  for (const layer of recipe.layers) {
    const source = layer.kind === "tone"
      ? playTone(graph, voice.input, layer, start, rate)
      : playNoise(graph, voice.input, layer, start, rate, random);
    if (source && (!last || layerEnd(layer) > last.end)) last = { source, end: layerEnd(layer) };
  }
  if (!last) { voice.release(); return; }
  const { source } = last, ended = source.onended;
  source.onended = (event) => { if (typeof ended === "function") ended.call(source, event); voice.release(); };
};

/** 白色ノイズ 1 秒。ノイズの層はこの 1 本をずらして読む */
export const createNoiseBuffer = (ctx: BaseAudioContext, random: () => number = Math.random): AudioBuffer => {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
  return buffer;
};

/** 爆発の尾に使う短い残響。左右で別のノイズを指数で減衰させる */
export const createImpulse = (ctx: BaseAudioContext, seconds = 1.6, decay = 0.38, random: () => number = Math.random): AudioBuffer => {
  const frames = Math.round(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, frames, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < frames; i++) data[i] = (random() * 2 - 1) * Math.exp(-i / ctx.sampleRate / decay);
  }
  return buffer;
};
