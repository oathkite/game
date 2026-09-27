import { damageSummary } from "./damageSummary";
import { weaponSound } from "@/app/weaponSounds";
import { shotFlashes } from "./muzzlePose";
import { shotRecoil } from "./shotRecoil";
import { COLOR_HEX, type CellPoint, type Impact, type Seat } from "@game/protocol";
import { carve, isRingOut, MAP_HEIGHT, ONE, tiltOf, weaponSpec, type ProjectilePath, type TerrainMask } from "@game/sim";
import type { SoundName } from "@/app/audio";
import type { PlayerView, ReplayJob } from "@/match/types";
import {
  blastFrameAt,
  CARVE_AT_MS,
  damageLabelText,
  damageTier,
  HITSTOP_MS,
  HOLD_MS,
  HP_DRAIN_MS,
  damageSounds,
  debrisAt,
  flashMsOf,
  hpBarAt,
  IMPACT_TOTAL_MS,
  impactTimeMs,
  invertCells,
  knockbackAt,
  invertOn,
  launchDelayMs,
  MISS_MS,
  missMarkAt,
  projectileFrameAt,
  shakeOffsetAt,
  STEP_MS,
} from "./hitFeedback";
import type { ProjectileView } from "./projectileView";
import { hash32 } from "./fx/hash";
import { TEAM_RAMPS } from "./palette";
import { WRECK_BLINK_MS } from "./tankMotion";
import { replayTailMs } from "@game/engine/replay-timing";
import { trailDots } from "./trail";
import type { EdgePoint, Renderer } from "./renderer";
import { edgeBlinkOn } from "./edgeMarker";
import type { TankPose } from "./tankView";

// 射撃結果の再生。設計書 03 の 3.9。弾道は 1 ステップ 1/60 秒で進め、着弾で弾を一瞬止め、爆風の膨張、地形の削り、落下を順に描く。
// 1 発の射撃に弾道は複数（扇）、着弾も複数（段）ありうる（設計書 10）。弾道はそれぞれの発射の遅れから、着弾はそれぞれの時刻から独立に演出し、
// 地形と HP は着弾が削れた順に積み上げる。着弾の時間の流れは hitFeedback.ts が決める。

export type ReplayCallbacks = {
  readonly sound: (name: SoundName) => void;
  readonly done: () => void;
  readonly onImpact?: (mask: TerrainMask, impact: Impact) => void;
  readonly roundEnd?: boolean;
  /** 利用者が動きを減らす設定にしている。画面揺れを出さない */
  readonly reduceMotion: boolean;
};

/** 最後の着弾が削れてから多段の合計を出すまで（ms） */
export const TOTAL_AFTER_CARVE_MS = 150;

/** 落下の速さ（セル/秒） */
const FALL_CELLS_PER_S = 90;

type Fall = { readonly seat: Seat; readonly from: number; readonly to: number };

type Phase = "shot" | "fall" | "hold" | "done";

/** HP バーの減り。減る前の値から後の値へ、at から減らしていく。from は爆心の x（押し戻しの向き）、damage はこの着弾のダメージ */
type Drain = { readonly before: number; readonly after: number; readonly at: number; readonly from: number; readonly damage: number };

/** 着弾 1 つの再生の状態 */
type ImpactRun = {
  readonly impact: Impact;
  readonly key: string;
  /** 再生の開始からこの着弾までの時間 */
  readonly at: number;
  exploded: boolean;
  carved: boolean;
  /** 最後の着弾で、その後に飛んでいる弾がない。削る瞬間にヒットストップを入れる（設計書 41.6） */
  readonly final: boolean;
};

/** 再生 1 回分の可変状態 */
type Run = {
  readonly renderer: Renderer;
  readonly job: ReplayJob;
  readonly view: ProjectileView;
  readonly elevations: readonly [number, number];
  readonly mySeat: Seat | null;
  readonly cb: ReplayCallbacks;
  readonly falls: readonly Fall[];
  /** 弾道ごとの発射の遅れ */
  readonly launchAt: readonly number[];
  /** 弾道ごとの位置列をセルに直したもの。軌跡に使う */
  readonly trails: readonly (readonly { readonly x: number; readonly y: number }[])[];
  readonly impacts: readonly ImpactRun[];
  summaryAt: number | null;
  /** 多段の合計を出したか。最後の着弾が削れてから TOTAL_AFTER_CARVE_MS で出す（設計書 41.13） */
  totalShown: boolean;
  /** 最後に地形が削れた時刻 */
  lastCarveAt: number;
  /** 次の手番へ移ってよい時刻。飛翔の終わりからオンラインと同じ長さだけ留める（設計書 41.8） */
  readonly doneAt: number;
  phase: Phase;
  elapsed: number;
  phaseStart: number;
  /** 着弾で削られていく地形 */
  mask: TerrainMask;
  /** 着弾で減っていく HP */
  hp: [number, number];
  /** ヒットストップの残り（ms） */
  freezeLeft: number;
  /** 発射の煙の輪を出した弾道 */
  readonly launched: boolean[];
  /** 地形が削れて、土の雨と焼ける音を鳴らしたか。1 回の射撃で 1 回だけ（設計書 41.14） */
  crumbled: boolean;
  /** 時刻が来たら鳴らす音。撃破の爆発に合わせる */
  readonly pendingSounds: { readonly at: number; readonly name: SoundName }[];
  readonly flashUntil: [number, number];
  readonly drains: [Drain | null, Drain | null];
  shake: { readonly at: number; readonly damage: readonly [number, number] } | null;
  stopFrames: () => void;
};

const poseOf = (p: PlayerView, mask: TerrainMask, elevation: number, over: Partial<TankPose> = {}): TankPose => ({
  x: p.x,
  y: p.y,
  tilt: tiltOf(mask, p),
  facing: p.facing,
  elevation,
  hp: p.hp,
  visible: !isRingOut(mask, p),
  flash: false,
  // 再生の間は狙いを付ける時間ではないので線を出さない
  aiming: false,
  ...over,
});

const elevationOf = (run: Run, seat: Seat): number => (seat === run.job.shot.input.seat ? run.job.shot.input.elevation : run.elevations[seat]);

/** 落下前の地表。撃った側は移動後の位置（input.y）、相手はターン開始時の位置 */
const groundBeforeFall = (job: ReplayJob, seat: Seat): number => (seat === job.shot.input.seat ? job.shot.input.y : job.playersBefore[seat].y);

/** 着弾で地面を失った機体の落下。落下前の地表と、サーバーが決めた落下後の地表の差から求める */
const computeFalls = (job: ReplayJob): Fall[] => {
  const falls: Fall[] = [];
  for (const seat of [0, 1] as const) {
    const from = groundBeforeFall(job, seat);
    const after = job.playersAfter[seat];
    const to = isRingOut(job.maskAfter, after) ? MAP_HEIGHT + 12 : after.y;
    if (to > from) falls.push({ seat, from, to });
  }
  return falls;
};

/** 時刻（ms）を比べるときに許す誤差 */
const TIME_EPSILON_MS = 1e-6;

/** 着弾の後に弾が飛んでいないか（飛翔の終わりが、着弾で止まる HOLD_MS の終わりより後でない）。
 * 両辺は STEP_MS（1000/60）の和を別の順で足すので、浮動小数点の誤差を許して比べる */
export const endsWithImpact = (flightEnd: number, impactAt: number): boolean => flightEnd - (impactAt + HOLD_MS) <= TIME_EPSILON_MS;

/** 弾道ごとの発射の遅れと、着弾ごとの時刻。弾道の位置列はクライアントの再計算から得る */
const timeline = (job: ReplayJob): { launchAt: number[]; impacts: ImpactRun[] } => {
  const fanCount = weaponSpec(job.shot.input.weapon).fan.length;
  const launchAt = job.paths.map((_, p) => launchDelayMs(p, fanCount));
  const impacts = job.shot.impacts.map((impact) => {
    const path = job.paths[impact.projectile];
    const at = (launchAt[impact.projectile] ?? 0) + impactTimeMs(impact.stage, path?.impactAt ?? []);
    return { impact, key: `${impact.projectile}/${impact.stage}`, at, exploded: false, carved: false, final: false };
  });
  // 最後の着弾は、その後に弾が飛んでいないときだけヒットストップの対象にする
  const last = impacts.reduce<ImpactRun | null>((a, b) => (a === null || b.at > a.at ? b : a), null);
  const flightEnd = Math.max(0, ...job.paths.map((_, p) => flightEndOf(job, launchAt, p)));
  return { launchAt, impacts: impacts.map(ir => (ir === last && endsWithImpact(flightEnd, ir.at) ? { ...ir, final: true } : ir)) };
};

/** 着弾後の位置で、地形は着弾前のまま描く。落下前の姿勢。HP バーは削れてからの時間で減らしていく */
const poseAfterHit = (run: Run, seat: Seat, flash: boolean): TankPose => {
  const before = run.job.playersBefore[seat];
  const after = run.job.playersAfter[seat];
  const drain = run.drains[seat];
  const bar = drain ? hpBarAt(run.elapsed - drain.at, drain.before, drain.after) : { hp: run.hp[seat], hpGhost: run.hp[seat], ghostOn: false };
  // 落下前なので、撃った側は移動後の地表、相手はターン開始時の地表に立つ
  return poseOf({ ...before, hp: bar.hp, x: after.x, y: groundBeforeFall(run.job, seat), facing: after.facing }, run.job.maskBefore, elevationOf(run, seat), {
    flash,
    shotFlashes: seat === run.job.shot.input.seat ? shotFlashes(run.elapsed, run.launchAt) : [],
    recoil: seat === run.job.shot.input.seat ? shotRecoil(run.elapsed, run.launchAt) : 0,
    hpGhost: bar.hpGhost,
    ghostOn: bar.ghostOn,
    nudge: drain && !run.cb.reduceMotion ? knockbackAt(run.elapsed - drain.at, drain.damage) * (after.x >= drain.from ? 1 : -1) : 0,
  });
};

/** 落下まで終えた姿にして、留める時間が過ぎるのを待つ */
const finish = (run: Run): void => {
  if (run.phase === "done" || run.phase === "hold") return;
  run.phase = "hold";
  run.view.clear();
  for (const seat of [0, 1] as const) run.renderer.setTank(seat, poseOf(run.job.playersAfter[seat], run.job.maskAfter, elevationOf(run, seat)));
  run.renderer.setShake({ dx: 0, dy: 0 });
  run.renderer.setEdgeMarkers([], false);
  stepHold(run);
};

const stepHold = (run: Run): void => {
  if (run.elapsed < run.doneAt) return;
  run.phase = "done";
  run.stopFrames();
  run.cb.done();
};

const enterFall = (run: Run): void => {
  run.phase = "fall";
  run.phaseStart = run.elapsed;
  run.view.clear();
  run.renderer.setEdgeMarkers([], false);
  run.renderer.setTerrain(run.job.maskAfter);
  for (const seat of [0, 1] as const) {
    run.renderer.setTank(seat, poseOf(run.job.playersAfter[seat], run.job.maskBefore, elevationOf(run, seat), { visible: true }));
  }
  if (run.falls.length === 0) finish(run);
};

/** 位置列の添字 i 付近の進む向き。静止中の弾も飛んできた向きのまま描く */
const angleAt = (points: ProjectilePath["points"], i: number): number => {
  const k = Math.min(points.length - 1, Math.max(1, Math.ceil(i)));
  const a = points[k - 1];
  const b = points[k];
  return a && b ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
};

const cellOfPoint = (p: { readonly x: number; readonly y: number }): CellPoint => ({ x: Math.floor(p.x / ONE), y: Math.floor(p.y / ONE) });

/** 弾道 p の弾の位置と尾。発射前は隠す。着弾が 1 つも無い弾道は、消えた位置に外れの印を出す */
const updateBullet = (run: Run, p: number): void => {
  const path = run.job.paths[p];
  const t = run.elapsed - (run.launchAt[p] ?? 0);
  if (!path || t < 0) {
    run.view.setBullet(p, null, 0, 0);
    return;
  }
  const points = path.points;
  if (!run.launched[p] && points[0]) {
    run.launched[p] = true;
    // 砲口の煙の輪と発射光の光（段階 4）、武器の軌跡（段階 5）。弾がその点を通る時刻は、着弾ごとに止まる分を足して決める
    const trail = points.map((q, i) => ({ x: q.x / ONE, y: q.y / ONE, at: i * STEP_MS + path.impactAt.filter(k => k < i).length * HOLD_MS }));
    run.renderer.effects.launch(run.job.shot.input.weapon, trail, hash32(0, run.job.id, p, 9), t);
  }
  const frame = projectileFrameAt(t, path.impactAt, points.length);
  const last = points[points.length - 1];
  if (frame.ended && last) {
    run.view.setBullet(p, null, 0, 0);
    run.view.setTrail(p, []);
    const mark = path.impactAt.length === 0 ? missMarkAt(t - (points.length - 1) * STEP_MS, cellOfPoint(last)) : null;
    run.view.setMissMark(`miss/${p}`, mark ? mark.x : null, mark?.y ?? 0, mark?.on ?? false);
    return;
  }
  const i = Math.floor(frame.index);
  const a = points[i];
  const b = points[i + 1] ?? a;
  if (!a || !b) return;
  const f = frame.index - i;
  run.view.setBullet(p, (a.x + (b.x - a.x) * f) / ONE, (a.y + (b.y - a.y) * f) / ONE, angleAt(points, frame.holding ? i : frame.index));
  run.view.setTrail(p, trailDots(run.trails[p] ?? [], frame.index));

};

/** 爆風が最大に達した瞬間。地形を削り、被弾した機体を白くし、HP を減らし始め、被弾と手応えの音を鳴らす */
const carveImpact = (run: Run, ir: ImpactRun): void => {
  ir.carved = true;
  run.lastCarveAt = run.elapsed;
  const { impact } = ir;
  const before = run.mask;
  run.mask = carve(run.mask, impact.terrainOp);
  // 削れた地形のドットを散らして落とす（設計書 41.5 の D1）。練習は対戦の識別子を 0 とする（41.3）
  if (!run.cb.reduceMotion) run.renderer.effects.crater(before, run.mask, impact.terrainOp, hash32(0, run.job.id, impact.projectile, impact.stage), 0, run.job.shot.input.weapon);
  if (ir.final && !run.cb.reduceMotion) { run.freezeLeft = HITSTOP_MS; run.renderer.effects.freeze(HITSTOP_MS); }
  // 演出に合わせた音（設計書 41.14）。動きを減らす設定でも、何が起きたかを伝えるので鳴らす
  if (ir.final) run.cb.sound("impactStop");
  if (!run.crumbled) { run.crumbled = true; run.cb.sound("debris"); run.cb.sound("sizzle"); }
  run.cb.onImpact?.(run.mask, impact);
  run.renderer.setTerrain(run.mask, impact.terrainOp);
  const shooter = run.job.shot.input.seat;
  const shooterColor = run.job.playersBefore[shooter].colors.primary;
  const hpBefore: [number, number] = [run.hp[0], run.hp[1]];
  run.hp = [run.hp[0] - impact.damage[0], run.hp[1] - impact.damage[1]];
  for (const seat of [0, 1] as const) {
    const damage = impact.damage[seat];
    if (damage <= 0) continue;
    // 減り始めの値は、前の着弾の減りが途中なら今見えている値
    const prev = run.drains[seat];
    const shown = prev ? hpBarAt(run.elapsed - prev.at, prev.before, prev.after).hp : hpBefore[seat];
    run.drains[seat] = { before: shown, after: run.hp[seat], at: run.elapsed, from: impact.cell.x, damage };
    run.flashUntil[seat] = Math.max(run.flashUntil[seat], run.elapsed + flashMsOf(damage));
    run.renderer.showDamage(seat, damageLabelText(damage), shooterColor, damage >= 50);
    // 撃破の明滅（C5）が始まる瞬間。HP バーが減りきったとき
    if (hpBefore[seat] > 0 && run.hp[seat] <= 0) {
      run.renderer.effects.killFlash(HP_DRAIN_MS);
      // 撃破の最初の爆発（38.3 の C5、明滅が始まってから 260 ms）で機体の色の破片を散らす
      const after = run.job.playersAfter[seat];
      run.renderer.effects.wreck(after.x, groundBeforeFall(run.job, seat), TEAM_RAMPS[after.colors.primary], hash32(0, run.job.id, seat, 11), HP_DRAIN_MS + WRECK_BLINK_MS, seat);
      run.pendingSounds.push({ at: run.elapsed + HP_DRAIN_MS + WRECK_BLINK_MS, name: "destroy" });
    }
  }
  if (impact.damage[0] > 0 || impact.damage[1] > 0) run.shake = { at: run.elapsed, damage: impact.damage };
  for (const name of damageSounds(impact.damage, hpBefore, run.hp, shooter, run.mySeat)) run.cb.sound(name);
};

/** 着弾 1 つの爆風と破片。時刻が来るまでは何も描かない */
const updateImpact = (run: Run, ir: ImpactRun): void => {
  const t = run.elapsed - ir.at;
  if (t < 0) return;
  if (!ir.exploded) {
    ir.exploded = true;
    run.cb.sound(weaponSound(run.job.shot.input.weapon, "impact"));
    // 火花、煙、光は爆風が広がり始める瞬間に生まれる（設計書 41.6）
    if (!run.cb.reduceMotion) {
      const { cell, terrainOp, damage } = ir.impact;
      run.renderer.effects.impact({ cx: cell.x, cy: cell.y, radius: terrainOp.radius, tier: damageTier(Math.max(damage[0], damage[1])), seed: hash32(0, run.job.id, ir.impact.projectile, ir.impact.stage), age: -HOLD_MS, weapon: run.job.shot.input.weapon, mask: run.mask });
    }
  }
  const { cell, terrainOp } = ir.impact;
  const frame = blastFrameAt(t, terrainOp.radius);
  // 動きを減らす設定では明滅させず、熱い火球のまま見せる（設計書 40.9）
  run.view.setBlast(ir.key, frame ? cell.x : null, cell.y, frame?.radius ?? 0, (frame?.on ?? false) || run.cb.reduceMotion, frame?.ring ?? false, run.cb.reduceMotion ? 1 : Math.min(3, Math.floor(t / IMPACT_TOTAL_MS * 4)));
  if (frame?.carved && !ir.carved) carveImpact(run, ir);
  if (ir.carved) run.view.setDebris(ir.key, debrisAt(t - CARVE_AT_MS, cell, terrainOp.radius));
  const damage = Math.max(ir.impact.damage[0], ir.impact.damage[1]);
  run.view.setInvert(ir.key, invertOn(t, damage, run.cb.reduceMotion) ? invertCells(run.mask, cell.x, cell.y, terrainOp.radius) : null);
};

/** 被弾してから EDGE_HOLD_MS の間、画面の外にいる機体の向きを端に出す */
const EDGE_HOLD_MS = 1000;
const hitMarkers = (run: Run): readonly EdgePoint[] => ([0, 1] as const).flatMap(seat => {
  const drain = run.drains[seat];
  if (!drain || run.elapsed - drain.at >= EDGE_HOLD_MS) return [];
  const after = run.job.playersAfter[seat];
  return [{ x: after.x, y: groundBeforeFall(run.job, seat) - 4, color: Number.parseInt(COLOR_HEX[run.job.playersBefore[seat].colors.primary].slice(1), 16) }];
});

/** 被弾の見せ方。白はダメージが大きいほど長く続き、HP バーは減っていき、画面が揺れる */
const updateHits = (run: Run): void => {
  for (const seat of [0, 1] as const) {
    if (run.drains[seat] || seat === run.job.shot.input.seat) run.renderer.setTank(seat, poseAfterHit(run, seat, run.elapsed < run.flashUntil[seat]));
  }
  run.renderer.setEdgeMarkers(hitMarkers(run), edgeBlinkOn(run.elapsed, run.cb.reduceMotion));
  if (run.cb.reduceMotion) return;
  run.renderer.setShake(run.shake ? shakeOffsetAt(run.elapsed - run.shake.at, run.shake.damage) : { dx: 0, dy: 0 });
};

/** 弾道 p が着弾し終えるか、画面の外へ消える時刻 */
const flightEndOf = (job: ReplayJob, launchAt: readonly number[], p: number): number => {
  const path = job.paths[p];
  return path ? (launchAt[p] ?? 0) + impactTimeMs(path.impactAt.length, [...path.impactAt, path.points.length - 1]) : 0;
};

/** すべての弾道が終わり、すべての着弾の演出と外れの印が消えたか */
const shotDone = (run: Run): boolean => {
  const impactsDone = run.impacts.every((ir) => run.elapsed - ir.at >= (run.cb.roundEnd ? CARVE_AT_MS + 100 : IMPACT_TOTAL_MS));
  const pathsDone = run.job.paths.every((path, p) => run.elapsed >= flightEndOf(run.job, run.launchAt, p) + (path.impactAt.length === 0 ? MISS_MS : 0));
  return impactsDone && pathsDone;
};

const stepShot = (run: Run): void => {
  for (let p = 0; p < run.job.paths.length; p++) updateBullet(run, p);
  for (const ir of run.impacts) updateImpact(run, ir);
  updateHits(run);
  if (!run.totalShown && run.impacts.every(ir => ir.carved) && run.elapsed - run.lastCarveAt >= TOTAL_AFTER_CARVE_MS) {
    run.totalShown = true;
    for (const seat of [0, 1] as const) {
      const summary = damageSummary(run.impacts.map(ir => ir.impact.damage[seat]));
      if (summary.hits > 1) run.renderer.showDamage(seat, String(summary.total), "green", summary.big, true);
    }
  }
  if (run.summaryAt === null && run.impacts.every(ir => ir.carved) && shotDone(run)) run.summaryAt = run.elapsed;
  const hit = run.impacts.some(ir => ir.impact.damage.some(amount => amount > 0));
  if (run.summaryAt !== null && run.elapsed - run.summaryAt >= (hit ? 1000 : 0)) enterFall(run);
};

const stepFall = (run: Run): void => {
  const t = (run.elapsed - run.phaseStart) / 1000;
  let allDone = true;
  for (const f of run.falls) {
    const y = Math.min(f.to, f.from + FALL_CELLS_PER_S * t);
    if (y < f.to) allDone = false;
    run.renderer.setTank(f.seat, poseOf(run.job.playersAfter[f.seat], run.job.maskBefore, elevationOf(run, f.seat), { y, falling: y < f.to, visible: y < MAP_HEIGHT + 6 }));
  }
  if (allDone) finish(run);
};

const stepFrame = (run: Run, deltaMs: number): void => {
  const frozen = Math.min(run.freezeLeft, deltaMs);
  run.freezeLeft -= frozen;
  run.elapsed += deltaMs - frozen;
  for (let i = run.pendingSounds.length - 1; i >= 0; i--) {
    const pending = run.pendingSounds[i]!;
    if (run.elapsed >= pending.at) { run.cb.sound(pending.name); run.pendingSounds.splice(i, 1); }
  }
  if (run.phase === "shot") stepShot(run);
  else if (run.phase === "fall") stepFall(run);
  else if (run.phase === "hold") stepHold(run);
};

/** 再生を始める。返り値で中断できる */
export const playReplay = (
  renderer: Renderer,
  job: ReplayJob,
  elevations: readonly [number, number],
  mySeat: Seat | null,
  cb: ReplayCallbacks,
): (() => void) => {
  const shooter = job.playersBefore[job.shot.input.seat];
  const { launchAt, impacts } = timeline(job);
  const run: Run = {
    renderer,
    job,
    view: renderer.projectile(shooter.colors.primary, job.shot.input.weapon),
    elevations,
    mySeat,
    cb,
    falls: computeFalls(job),
    launchAt,
    trails: job.paths.map(path => path.points.map(q => ({ x: q.x / ONE, y: q.y / ONE }))),
    impacts,
    summaryAt: null,
    totalShown: false,
    lastCarveAt: 0,
    // 決着のターンはこれまでどおり早くリザルトへ進めるので留めない
    doneAt: cb.roundEnd ? 0 : Math.max(0, ...job.paths.map((_, p) => flightEndOf(job, launchAt, p))) + replayTailMs(job.shot.impacts),
    phase: "shot",
    elapsed: 0,
    phaseStart: 0,
    mask: job.maskBefore,
    hp: [job.playersBefore[0].hp, job.playersBefore[1].hp],
    freezeLeft: 0,
    launched: job.paths.map(() => false),
    crumbled: false,
    pendingSounds: [],
    flashUntil: [0, 0],
    drains: [null, null],
    shake: null,
    stopFrames: () => {},
  };
  // 再生初期化から移動後のx/yを使用し、ターン開始位置を一瞬描画しない。
  for (const seat of [0, 1] as const) {
    const before = job.playersBefore[seat];
    const position = seat === job.shot.input.seat
      ? { ...before, x: job.shot.input.x, y: job.shot.input.y, facing: job.shot.input.facing }
      : before;
    renderer.setTank(seat, poseOf(position, job.maskBefore, elevationOf(run, seat)));
  }
  cb.sound(weaponSound(job.shot.input.weapon, "fire"));
  run.stopFrames = renderer.onFrame((deltaMs) => stepFrame(run, deltaMs));
  return () => {
    if (run.phase === "done") return;
    run.phase = "done";
    run.view.clear();
    run.renderer.setShake({ dx: 0, dy: 0 });
    run.renderer.setEdgeMarkers([], false);
    run.stopFrames();
  };
};
