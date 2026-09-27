import { MAP_HEIGHT, MAP_WIDTH, type WeaponId } from "@game/protocol";
import { maskFromHeights, simulateShot, spawnPos, tiltOf, type TerrainMask } from "@game/sim";
import { UPDATE_PRIORITY } from "pixi.js";
import { createRenderer, type Renderer } from "@/game/renderer";
import { playReplay } from "@/game/replay";
import type { TankPose } from "@/game/tankView";
import type { PlayerView, ReplayJob } from "@/match/types";

// 演出を調整する開発用の画面（FX ラボ）。設計書 41.11。
// なだらかな地形に的の機体を置き、練習と同じ再生（replay.ts）で同じ条件の射撃を撃ち続ける。
// 速さ、一時停止、コマ送り、粒の数とフレーム時間の測定を持つ。import.meta.env.DEV の中からだけ読み込む。

export type FxLabStats = {
  readonly frames: number;
  /** 描画の間隔（ms） */
  readonly frameP50: number;
  readonly frameP95: number;
  /** 1 フレームの JavaScript と描画命令の時間（ms）。GPU の処理は含まない */
  readonly workP50: number;
  readonly workP95: number;
  readonly particles: number;
  readonly maxParticles: number;
  /** 今の射撃で地形が削れた回数。決めた時刻を削る瞬間から数えるのに使う */
  readonly carves: number;
};

export type FxLab = {
  readonly fire: (weapon: WeaponId) => void;
  readonly setLoop: (on: boolean) => void;
  readonly setSpeed: (speed: number) => void;
  readonly setReduceMotion: (on: boolean) => void;
  /** 的の HP。撃破の演出を見るときに下げる */
  readonly setTargetHp: (hp: number) => void;
  readonly pause: () => void;
  readonly resume: () => void;
  /** 止めたまま ms だけ進める。16 ms ずつ描く（端数は切り上げて 1 コマ） */
  readonly step: (ms: number) => void;
  readonly stats: () => FxLabStats;
  readonly resetStats: () => void;
  readonly destroy: () => void;
};

/** 撃つ側と的の x（セル） */
const SHOOTER_X = 160;
const TARGET_X = 225;
/** 撃ち終わってから次を撃つまで（ms） */
const LOOP_GAP_MS = 700;
/** 測定に使う直近のフレーム数 */
const SAMPLE_FRAMES = 600;
/** コマ送りの 1 コマ（ms）。2 進数で割り切れる値にして、足し合わせても丸めの誤差が出ないようにする */
const STEP_MS = 16;
const LAB_JOB_ID = 1;

/** なだらかな丘の地形。的の手前に小さな盛り上がりを置く */
const labTerrain = (): TerrainMask =>
  maskFromHeights(Array.from({ length: MAP_WIDTH }, (_, x) => 150 + Math.round(4 * Math.sin(x / 13) + 2 * Math.sin(x / 5.3)) - (Math.abs(x - 200) < 8 ? 5 : 0)), MAP_HEIGHT);

const player = (seat: 0 | 1, mask: TerrainMask, x: number): PlayerView => ({
  seat,
  nickname: seat === 0 ? "shooter" : "target",
  colors: seat === 0 ? { primary: "yellow", secondary: "blue" } : { primary: "cyan", secondary: "white" },
  loadout: ["cannon", "digger"],
  hp: 100,
  ...spawnPos(mask, x),
  facing: seat === 0 ? 1 : -1,
  connected: true,
});

type Aim = { readonly elevation: number; readonly power: number };

/** 的に最も大きなダメージが入る照準。当たらなければ、最初の着弾が的に最も近い照準 */
const aimAt = (mask: TerrainMask, players: readonly [PlayerView, PlayerView], weapon: WeaponId): Aim => {
  let best = { elevation: 45, power: 60, score: -Infinity };
  const combatants = [players[0], players[1]] as const;
  for (let elevation = 15; elevation <= 80; elevation += 5) for (let power = 20; power <= 96; power += 2) {
    const r = simulateShot(mask, combatants, { seat: 0, weapon, x: players[0].x, y: players[0].y, facing: 1, elevation, power, wind: 0 }).result;
    const damage = r.impacts.reduce((sum, i) => sum + i.damage[1] - i.damage[0], 0);
    const first = r.impacts[0];
    const score = damage > 0 ? 1000 + damage : first ? -Math.hypot(first.cell.x - players[1].x, first.cell.y - players[1].y) : -9999;
    if (score > best.score) best = { elevation, power, score };
  }
  return { elevation: best.elevation, power: best.power };
};

const jobOf = (id: number, mask: TerrainMask, players: readonly [PlayerView, PlayerView], weapon: WeaponId, aim: Aim): ReplayJob => {
  const input = { seat: 0 as const, weapon, x: players[0].x, y: players[0].y, facing: 1 as const, elevation: aim.elevation, power: aim.power, wind: 0 };
  const outcome = simulateShot(mask, [players[0], players[1]], input);
  const after = (p: PlayerView): PlayerView => ({ ...p, hp: outcome.result.hpAfter[p.seat], x: outcome.result.xAfter[p.seat], y: outcome.result.yAfter[p.seat] });
  return { id, shot: outcome.result, paths: outcome.paths, maskBefore: mask, maskAfter: outcome.mask, playersBefore: players, playersAfter: [after(players[0]), after(players[1])] };
};

const poseOf = (p: PlayerView, mask: TerrainMask, elevation: number): TankPose => ({
  x: p.x, y: p.y, tilt: tiltOf(mask, p), facing: p.facing, elevation, hp: p.hp, visible: true, flash: false, aiming: false,
});

const percentile = (values: readonly number[], q: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!.toFixed(2));
};

/** 描画の間隔と、1 フレームの仕事の時間を測る */
const createMeter = (r: Renderer) => {
  let frames: number[] = [], work: number[] = [], started = 0, maxParticles = 0;
  const begin = (): void => { started = performance.now(); };
  const end = (): void => {
    const ticker = r.app.ticker;
    frames.push(ticker.elapsedMS); work.push(performance.now() - started);
    if (frames.length > SAMPLE_FRAMES) { frames = frames.slice(-SAMPLE_FRAMES); work = work.slice(-SAMPLE_FRAMES); }
    maxParticles = Math.max(maxParticles, r.effects.particleCount());
  };
  r.app.ticker.add(begin, undefined, UPDATE_PRIORITY.INTERACTION);
  r.app.ticker.add(end, undefined, UPDATE_PRIORITY.UTILITY);
  return {
    stats: (): Omit<FxLabStats, "carves"> => ({ frames: frames.length, frameP50: percentile(frames, 0.5), frameP95: percentile(frames, 0.95), workP50: percentile(work, 0.5), workP95: percentile(work, 0.95), particles: r.effects.particleCount(), maxParticles }),
    reset: (): void => { frames = []; work = []; maxParticles = 0; },
  };
};

/** 2 台が画面の中央に来るように world をずらす */
const centerCamera = (r: Renderer, players: readonly [PlayerView, PlayerView], cell: number): void => {
  const cx = (players[0].x + players[1].x) / 2, cy = Math.min(players[0].y, players[1].y) - 8;
  r.setCameraOffset(Math.round(r.app.screen.width / 2 - cx * cell), Math.round(r.app.screen.height / 2 - cy * cell));
};

/** still なら描画の時計を自分では進めず、step でだけ進める。決めた時刻の絵を毎回同じにする */
export const createFxLab = async (host: HTMLElement, options: { readonly cell?: number; readonly still?: boolean } = {}): Promise<FxLab> => {
  const cell = options.cell ?? 8;
  const mask = labTerrain();
  let players: readonly [PlayerView, PlayerView] = [player(0, mask, SHOOTER_X), player(1, mask, TARGET_X)];
  const r = await createRenderer({ mapId: "ridgeline", host, layout: { cell, mapWidth: host.clientWidth, mapHeight: host.clientHeight, panelWidth: 0, panelCell: 1 }, mask, background: 0x000000, backgroundAlpha: 0, players, autoStart: !options.still });
  const meter = createMeter(r), aims = new Map<WeaponId, Aim>();
  let carves = 0;
  // 地形が削れた回数を数える renderer。再生には同じ描画を渡す
  const counted: Renderer = { ...r, effects: { ...r.effects, crater: (...a) => { carves++; r.effects.crater(...a); } } };
  let stop: () => void = () => {}, loop = true, weapon: WeaponId = "cannon", reduceMotion = false, waitMs = -1;
  const reset = (): void => {
    r.effects.clear();
    r.setTerrain(mask);
    players.forEach((p, seat) => r.setTank(seat, poseOf(p, mask, seat === 0 ? aims.get(weapon)?.elevation ?? 45 : 45)));
  };
  const fire = (w: WeaponId): void => {
    stop(); weapon = w; waitMs = -1; carves = 0;
    const aim = aims.get(w) ?? aimAt(mask, players, w);
    aims.set(w, aim);
    reset();
    // 再生の番号は散らし方の種になるので、同じ武器は毎回同じ絵になるよう固定する（設計書 41.3）
    stop = playReplay(counted, jobOf(LAB_JOB_ID, mask, players, w, aim), [aim.elevation, 45], 0, { sound: () => {}, reduceMotion, done: () => { if (loop) waitMs = LOOP_GAP_MS; } });
  };
  // 次の射撃までの待ちも描画の時計で数え、一時停止とコマ送りに従わせる
  r.app.ticker.add(() => {
    if (waitMs < 0) return;
    waitMs -= r.app.ticker.deltaMS;
    if (waitMs < 0) fire(weapon);
  });
  centerCamera(r, players, cell);
  reset();
  return {
    fire,
    setLoop: (on) => { loop = on; },
    setSpeed: (speed) => { r.app.ticker.speed = speed; },
    setReduceMotion: (on) => { reduceMotion = on; },
    setTargetHp: (hp) => { players = [players[0], { ...players[1], hp }]; aims.clear(); },
    pause: () => { r.app.ticker.stop(); },
    resume: () => { r.app.ticker.start(); },
    step: (ms) => {
      const ticker = r.app.ticker, speed = ticker.speed;
      ticker.speed = 1;
      for (let i = 0; i < Math.ceil(ms / STEP_MS); i++) ticker.update(ticker.lastTime + STEP_MS);
      ticker.speed = speed;
    },
    stats: () => ({ ...meter.stats(), carves }),
    resetStats: meter.reset,
    destroy: () => { stop(); r.destroy(); },
  };
};
