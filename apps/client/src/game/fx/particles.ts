// 閉じた式で動く粒。設計書 41.4。
// 粒は生まれたときの値だけを持ち、時刻を渡すとその時の位置と色が決まる。状態を持たないので、練習の積算の時計でも、
// オンラインのサーバー時刻でも、再接続した途中からでも同じ絵になる。単位は art px（1/4 セル）と ms。y は下向きが正。

/** 同じ動き方の粒のまとまり。着弾 1 つの破片など。値は粒ごとの配列で持ち、描画中に割り当てない */
export type ParticleBatch = {
  readonly count: number;
  /** 生まれる時刻（まとまりの基準からの ms） */
  readonly t0: Float32Array;
  /** 寿命（ms） */
  readonly life: Float32Array;
  /** 生まれる位置（art px） */
  readonly x0: Float32Array;
  readonly y0: Float32Array;
  /** 初速（art px/秒） */
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  /** 色の段の番号（ramps の添字） */
  readonly ramp: Uint16Array;
  /** 色の段を 1 つ進める ms。0 なら寿命を段の数で割る */
  readonly step: Float32Array;
  /** 粒の大きさ。1〜3 art px 四方 */
  readonly size: Uint8Array;
  /** 消える順番を決める 0 以上 1 未満の値。ハッシュから作る */
  readonly fade: Float32Array;
  /** 色の段。40.4 のパレットの色の並び */
  readonly ramps: readonly (readonly number[])[];
  /** 重力（art px/秒²） */
  readonly gravity: number;
  /** 空気の抵抗（1/秒）。0 なら抵抗なし */
  readonly drag: number;
  /** 色の段ごとの大きさ（art px）。あれば粒ごとの size の代わりに使う。煙が昇るにつれ膨らむ、炎が昇るにつれ細くなる、など */
  readonly sizes?: readonly number[];
};

export type BatchOptions = {
  readonly ramps: readonly (readonly number[])[];
  readonly gravity: number;
  readonly drag: number;
  readonly sizes?: readonly number[];
};

/** count 粒のまとまりの入れ物を作る。値は作った側が埋める */
export const allocBatch = (count: number, options: BatchOptions): ParticleBatch => ({
  count,
  t0: new Float32Array(count),
  life: new Float32Array(count),
  x0: new Float32Array(count),
  y0: new Float32Array(count),
  vx: new Float32Array(count),
  vy: new Float32Array(count),
  ramp: new Uint16Array(count),
  step: new Float32Array(count),
  size: new Uint8Array(count),
  fade: new Float32Array(count),
  ramps: options.ramps,
  gravity: options.gravity,
  drag: options.drag,
  ...(options.sizes ? { sizes: options.sizes } : {}),
});

/** まとまりの粒がすべて消えるまでの ms */
export const spanOf = (b: ParticleBatch): number => {
  let span = 0;
  for (let i = 0; i < b.count; i++) span = Math.max(span, b.t0[i]! + b.life[i]!);
  return span;
};

/** 寿命の最後のこの割合で、fade の値が残りの割合を超える粒から消していく。半透明にはしない */
export const FADE_TAIL = 0.2;

/** 生まれてから tau ms の粒が見えているか */
export const visibleAt = (tau: number, life: number, fade: number): boolean => {
  if (tau < 0 || tau >= life) return false;
  const tail = life * FADE_TAIL;
  const left = life - tau;
  return left >= tail || fade < left / tail;
};

/** 描く粒を並べる入れ物。容量を超えた粒は描かない */
export type ParticleFrame = {
  n: number;
  readonly x: Int32Array;
  readonly y: Int32Array;
  readonly color: Uint32Array;
  readonly size: Uint8Array;
};

export const createFrame = (capacity: number): ParticleFrame => ({
  n: 0,
  x: new Int32Array(capacity),
  y: new Int32Array(capacity),
  color: new Uint32Array(capacity),
  size: new Uint8Array(capacity),
});

/** 描く範囲（art px）。この外の粒は並べない */
export type ArtBounds = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/** まとまり b の粒のうち、基準から t ms の時点で見えているものを out に足す。足した数を返す */
export const sampleBatch = (b: ParticleBatch, t: number, bounds: ArtBounds, out: ParticleFrame): number => {
  const start = out.n, capacity = out.x.length, g = b.gravity, k = b.drag;
  for (let i = 0; i < b.count && out.n < capacity; i++) {
    const tau = t - b.t0[i]!, life = b.life[i]!;
    if (!visibleAt(tau, life, b.fade[i]!)) continue;
    const s = tau / 1000;
    let x: number, y: number;
    if (k > 0) {
      const e = (1 - Math.exp(-k * s)) / k;
      x = b.x0[i]! + b.vx[i]! * e;
      y = b.y0[i]! + (g / k) * s + (b.vy[i]! - g / k) * e;
    } else {
      x = b.x0[i]! + b.vx[i]! * s;
      y = b.y0[i]! + b.vy[i]! * s + (g * s * s) / 2;
    }
    const px = Math.floor(x), py = Math.floor(y);
    if (px < bounds.left || px > bounds.right || py < bounds.top || py > bounds.bottom) continue;
    const ramp = b.ramps[b.ramp[i]!]!, step = b.step[i]! > 0 ? b.step[i]! : life / ramp.length;
    const stage = Math.floor(tau / step), sizes = b.sizes;
    out.x[out.n] = px;
    out.y[out.n] = py;
    out.color[out.n] = ramp[Math.min(ramp.length - 1, stage)]!;
    out.size[out.n] = sizes ? sizes[Math.min(sizes.length - 1, stage)]! : b.size[i]!;
    out.n++;
  }
  return out.n - start;
};
