import { Particle, ParticleContainer, Texture } from "pixi.js";
import { ART_PER_CELL } from "../pixelGrid";
import { createFrame, sampleBatch, spanOf, type ArtBounds, type ParticleBatch, type ParticleFrame } from "./particles";

// 粒を描く層。設計書 41.4 と 41.9。
// 再生（replay.ts、labReplay.ts）の外に置き、手番が変わっても粒を寿命が尽きるまで描く。
// 時計は描画の経過時間の積算で、まとまりごとに生まれた時刻をこの時計で持つ。
// 粒は Pixi の ParticleContainer に 1 × 1 の白い texture で並べ、tint で色を付ける。毎フレーム送るのは位置、大きさ、色だけ。

/** 1 回の描画で並べる粒の上限（層ごと）。超えた粒はその回だけ描かない（TBD-40） */
export const FX_CAPACITY = 20000;

export type FxDepth = "back" | "front";

export type FxLayer = {
  /** 地形より手前、機体より奥の層 */
  readonly back: ParticleContainer;
  /** 機体より手前の層 */
  readonly front: ParticleContainer;
  /** 描画の時計（ms） */
  readonly now: () => number;
  /** まとまりを足す。age は生まれてからの ms。負なら先の時刻に生まれる */
  readonly emit: (depth: FxDepth, batch: ParticleBatch, age?: number) => void;
  /** 時計を進め、範囲（art px）の中の粒を並べ直す */
  readonly tick: (deltaMs: number, bounds: ArtBounds) => void;
  /** 時計を ms だけ止める（ヒットストップ、設計書 41.6）。止めている間に来た描画の経過は捨てる */
  readonly freeze: (ms: number) => void;
  /** 今並べている粒の数 */
  readonly count: () => number;
  readonly clear: () => void;
  readonly destroy: () => void;
};

type Live = { readonly batch: ParticleBatch; readonly bornAt: number; readonly endAt: number };

/** 0xRRGGBB を Particle.color の形（BGR と不透明度）に直す */
const packColor = (rgb: number): number => ((rgb & 0xff) << 16) + (rgb & 0xff00) + ((rgb >>> 16) & 0xff) + (255 << 24);

/** 1 つの深さの粒。Particle を使い回し、並べる数だけ particleChildren に載せる */
const createDepth = () => {
  const container = new ParticleContainer({ texture: Texture.WHITE, dynamicProperties: { position: true, color: true, vertex: true, rotation: false, uvs: false } });
  const pool: Particle[] = [], colors = new Map<number, number>(), frame = createFrame(FX_CAPACITY);
  let live: Live[] = [], uploaded = 0;
  const colorOf = (rgb: number): number => {
    let packed = colors.get(rgb);
    if (packed === undefined) { packed = packColor(rgb); colors.set(rgb, packed); }
    return packed;
  };
  const place = (f: ParticleFrame): void => {
    const list = container.particleChildren;
    while (pool.length < f.n) pool.push(new Particle({ texture: Texture.WHITE }));
    for (let i = 0; i < f.n; i++) {
      const p = pool[i]!, s = f.size[i]! / ART_PER_CELL;
      p.x = f.x[i]! / ART_PER_CELL; p.y = f.y[i]! / ART_PER_CELL; p.scaleX = s; p.scaleY = s; p.color = colorOf(f.color[i]!);
    }
    if (list.length > f.n) list.length = f.n;
    for (let i = list.length; i < f.n; i++) list.push(pool[i]!);
    // 並べる数が増えたら、増えた粒の静的な値（texture の範囲）を送り直す
    if (f.n > uploaded) { uploaded = f.n; container.update(); }
  };
  return {
    container,
    add: (entry: Live): void => { live.push(entry); },
    render: (now: number, bounds: ArtBounds): void => {
      live = live.filter((l) => now < l.endAt);
      frame.n = 0;
      // 新しいまとまりから並べ、上限を超えたら古いまとまりの粒を描かない
      for (let i = live.length - 1; i >= 0; i--) sampleBatch(live[i]!.batch, now - live[i]!.bornAt, bounds, frame);
      place(frame);
    },
    count: (): number => frame.n,
    clear: (): void => { live = []; frame.n = 0; container.particleChildren.length = 0; },
  };
};

export const createFxLayer = (): FxLayer => {
  const depths = { back: createDepth(), front: createDepth() };
  let clock = 0, frozen = 0;
  return {
    back: depths.back.container,
    front: depths.front.container,
    now: () => clock,
    emit: (depth, batch, age = 0) => {
      if (batch.count === 0) return;
      const bornAt = clock - age;
      depths[depth].add({ batch, bornAt, endAt: bornAt + spanOf(batch) });
    },
    freeze: (ms) => { frozen = Math.max(frozen, ms); },
    tick: (deltaMs, bounds) => {
      const stop = Math.min(frozen, deltaMs);
      frozen -= stop;
      clock += deltaMs - stop;
      depths.back.render(clock, bounds);
      depths.front.render(clock, bounds);
    },
    count: () => depths.back.count() + depths.front.count(),
    clear: () => { depths.back.clear(); depths.front.clear(); frozen = 0; },
    destroy: () => { depths.back.container.destroy(); depths.front.container.destroy(); },
  };
};
