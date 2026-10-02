import { applyOps, buildInitialTerrain, isRingOut, walk, type TerrainMask } from "@game/sim";
import type { MoveSnapshot } from "@game/protocol/v2";
import type { LabFrame } from "@game/protocol/v2-lab";

// 本人の移動の予測（設計書 22.5）。サーバーの確定位置に、まだ確定していない移動命令を同じ walk で重ねて表示する。
// 命令は ack を待たずに送る。lab.ack は送った順に 1 つずつ返るので、送った命令の列と先頭から突き合わせる。

/** サーバーの token budget。1 歩の補給に 100 ms、ためても 2 歩（engine の movement.ts と同じ） */
const MOVE_INTERVAL_MS = 100, MOVE_BURST = 2;
/** サーバーが命令を記録して ackMoveSeq を進める理由。これ以外の拒否では、後に送った命令も sync-required で返る */
const RECORDED: ReadonlySet<string> = new Set(["accepted", "partial", "blocked", "rate-limited", "no-budget", "stopped"]);

export type OwnPose = { readonly x: number; readonly y: number; readonly facing: -1 | 1; readonly stepsLeft: number; readonly eliminated: boolean };
type Base = OwnPose & Pick<MoveSnapshot, "matchId" | "turnId" | "playerId" | "ackMoveSeq">;
/** ack を待っている命令。stale は手番の交代や記録されない拒否で無効になった命令で、ack が来ても予測に使わない */
type Move = { readonly kind: "move"; readonly moveSeq: number; readonly direction: -1 | 1; readonly stale: boolean };
type Sent = Move | { readonly kind: "fire"; readonly stale: boolean };
export type Prediction = {
  /** 自分の手番のときのサーバーの確定位置。手番でなければ null */
  readonly base: Base | null;
  readonly sent: readonly Sent[];
  /** サーバーが記録したが、まだ確定位置に入っていない移動。手番を終わらせた歩（奈落など）の ack は次の手番の snapshot を返すので、手番の終わりの frame まで予測に残す */
  readonly recorded: readonly Move[];
  readonly credit: number;
  readonly creditAt: number;
  /** 発射を送った。結果が返るまで移動も発射も送らない */
  readonly firing: boolean;
  /**
   * 次の自分の手番に使う向き（設計書 30 章）。サーバーは手番の初めを右向きにするので、自分の手番ではサーバーが歩を記録するまでこの向きを予測に使い、発射の命令で送る。
   * 自分の手番が終わったら、終わったときの向きを入れる。相手の手番に左右を押せば、その向きに替える
   */
  readonly facing: -1 | 1 | null;
};
type TurnCommand = Pick<MoveSnapshot, "matchId" | "turnId">;

export const EMPTY_PREDICTION: Prediction = { base: null, sent: [], recorded: [], credit: MOVE_BURST, creditAt: 0, firing: false, facing: null };

const baseOf = (s: MoveSnapshot): Base => ({ matchId: s.matchId, turnId: s.turnId, playerId: s.playerId, ackMoveSeq: s.ackMoveSeq, x: s.x, y: s.y, facing: s.facing, stepsLeft: s.stepsLeft, eliminated: s.eliminated });
const sameTurn = (base: Base, s: MoveSnapshot): boolean => base.matchId === s.matchId && base.turnId === s.turnId && base.playerId === s.playerId;
const staleAll = (sent: readonly Sent[]): readonly Sent[] => sent.map(e => ({ ...e, stale: true }));
const pending = (p: Prediction, base: Base) => [...p.recorded, ...p.sent].flatMap(e => e.kind === "move" && !e.stale && e.moveSeq > base.ackMoveSeq ? [e] : []);
const unconfirmed = (moves: readonly Move[], base: Base | null): readonly Move[] => base ? moves.filter(e => e.moveSeq > base.ackMoveSeq) : [];
/** 歩を重ねる前の向き。準備した向きは、サーバーがこの手番の歩をまだ 1 つも記録していないあいだだけ使う。記録した歩はサーバーの向きを歩の向きにする */
const baseFacing = (p: Prediction, base: Base): -1 | 1 => (p.facing !== null && base.ackMoveSeq === 0 ? p.facing : base.facing);
/** 手番の終わりの向き。歩は進めなくても向きを歩の向きにする（stepPose）ので、地形なしで求まる。脱落した後は手番が来ないので区別しない */
const endFacing = (p: Prediction, base: Base): -1 | 1 => pending(p, base).at(-1)?.direction ?? baseFacing(p, base);

/** サーバーの applyMove と同じ 1 歩。進めなくても向きは変わる（設計書 1.9）。脱落の後は動かない */
const stepPose = (mask: TerrainMask, pose: OwnPose, direction: -1 | 1): OwnPose => {
  const moved = walk(mask, pose, direction, pose.eliminated ? 0 : Math.min(1, pose.stepsLeft));
  return { x: moved.x, y: moved.y, facing: pose.eliminated ? pose.facing : direction, stepsLeft: pose.stepsLeft - moved.stepsUsed, eliminated: pose.eliminated || isRingOut(mask, moved) };
};

export const predictedPose = (p: Prediction, mask: TerrainMask): OwnPose | null => {
  if (!p.base) return null;
  const { x, y, stepsLeft, eliminated } = p.base, facing = baseFacing(p, p.base);
  return pending(p, p.base).reduce<OwnPose>((pose, e) => stepPose(mask, pose, e.direction), { x, y, facing, stepsLeft, eliminated });
};

/**
 * 受信した frame の移動。自分の手番になったら確定位置から予測を始め、手番でなくなったら送った命令を無効にする。
 * 手番の終わりの向き（撃った向き、撃たなければ最後に向いた向き）は、次の自分の手番へ引き継ぐ
 */
export const syncTurn = (p: Prediction, snapshot: MoveSnapshot, ownTurn: boolean, now: number): Prediction => {
  if (!ownTurn) return p.base ? { ...p, base: null, sent: staleAll(p.sent), recorded: [], firing: false, facing: endFacing(p, p.base) } : p;
  if (p.base && sameTurn(p.base, snapshot)) {
    if (snapshot.ackMoveSeq < p.base.ackMoveSeq) return p;
    const base = baseOf(snapshot);
    return { ...p, base, recorded: unconfirmed(p.recorded, base) };
  }
  return { base: baseOf(snapshot), sent: staleAll(p.sent), recorded: [], credit: MOVE_BURST, creditAt: now, firing: false, facing: p.facing };
};

/**
 * 1 歩を送るなら、命令に入れる moveSeq を返す。進めない歩（壁、歩数切れ）は向きが変わるときだけ送る。
 * 奈落の後と、budget を超える入力は送らない。サーバーも位置と向きを変えない入力で、記録と配信を増やさないためである
 */
export const requestMove = (p: Prediction, mask: TerrainMask, direction: -1 | 1, now: number): { readonly prediction: Prediction; readonly command: TurnCommand & { readonly moveSeq: number } } | null => {
  const pose = predictedPose(p, mask);
  if (!p.base || !pose || p.firing || pose.eliminated) return null;
  const moves = pose.stepsLeft > 0 && walk(mask, pose, direction, 1).stepsUsed > 0;
  const creditAt = Math.max(p.creditAt, now), credit = Math.min(MOVE_BURST, p.credit + (creditAt - p.creditAt) / MOVE_INTERVAL_MS);
  if (credit < 1 || (!moves && direction === pose.facing)) return null;
  const moveSeq = p.base.ackMoveSeq + pending(p, p.base).length + 1;
  return { prediction: { ...p, sent: [...p.sent, { kind: "move", moveSeq, direction, stale: false }], credit: credit - 1, creditAt },
    command: { matchId: p.base.matchId, turnId: p.base.turnId, moveSeq } };
};

/** 相手の手番に向きを準備する。前の手番から引き継いだ向きより優先する。自分の手番では使わない（移動の命令で向きを変える） */
export const prepareFacing = (p: Prediction, facing: -1 | 1): Prediction => (p.base || p.facing === facing ? p : { ...p, facing });

/** 発射の命令。ackMoveSeq は最後に送った移動、向きは予測の向き（サーバーは命令の向きで撃つ） */
export const requestFire = (p: Prediction, mask: TerrainMask): { readonly prediction: Prediction; readonly shot: TurnCommand & { readonly ackMoveSeq: number; readonly facing: -1 | 1 } } | null => {
  const pose = predictedPose(p, mask);
  if (!p.base || !pose || p.firing) return null;
  return { prediction: { ...p, sent: [...p.sent, { kind: "fire", stale: false }], firing: true },
    shot: { matchId: p.base.matchId, turnId: p.base.turnId, ackMoveSeq: p.base.ackMoveSeq + pending(p, p.base).length, facing: pose.facing } };
};

/** lab.ack を 1 つ受け取る。送った命令の先頭に対応する。snapshot が同じ手番なら確定位置として使う */
export const acknowledge = (p: Prediction, reason: string, snapshot: MoveSnapshot | null): Prediction => {
  const [head, ...rest] = p.sent;
  const base = p.base && snapshot && sameTurn(p.base, snapshot) && snapshot.ackMoveSeq >= p.base.ackMoveSeq ? baseOf(snapshot) : p.base;
  const next: Prediction = { ...p, base, sent: rest, recorded: unconfirmed(p.recorded, base) };
  if (!head || head.stale) return next;
  if (head.kind === "fire") return reason === "accepted" ? next : { ...next, firing: false };
  if (RECORDED.has(reason)) return { ...next, recorded: unconfirmed([...next.recorded, head], base) };
  // 記録されない拒否。後に送った移動も sync-required で返るので、確定位置からやり直す。発射の結果は待つ
  return { ...next, sent: rest.map(e => e.kind === "move" ? { ...e, stale: true } : e) };
};

/** 受信と送信の間で予測を持つ。地形は削られたときだけ作り直す */
export const createMovePredictor = () => {
  let state = EMPTY_PREDICTION, mask: TerrainMask | null = null, terrain = "", match = "";
  return {
    frame(frame: LabFrame, ownId: string, now: number): void {
      // 再戦は同じ接続で新しい対戦を始める。前の対戦の向きを引き継がない
      if (frame.matchId !== match) { match = frame.matchId; state = { ...state, facing: null }; }
      const key = `${frame.matchId}/${frame.terrainOps.length}`;
      if (!mask || key !== terrain) { terrain = key; mask = applyOps(buildInitialTerrain(frame.map), frame.terrainOps); }
      state = syncTurn(state, frame.movement, frame.phase === "acting" && frame.movement.playerId === ownId, now);
    },
    ack(reason: string, snapshot: MoveSnapshot | null): void { state = acknowledge(state, reason, snapshot); },
    move(direction: -1 | 1, now: number) {
      const request = mask ? requestMove(state, mask, direction, now) : null;
      if (request) state = request.prediction;
      return request?.command ?? null;
    },
    fire() {
      const request = mask ? requestFire(state, mask) : null;
      if (request) state = request.prediction;
      return request?.shot ?? null;
    },
    prepareFacing(facing: -1 | 1): void { state = prepareFacing(state, facing); },
    pose: (): OwnPose | null => mask ? predictedPose(state, mask) : null,
    /** 自分の手番でないときの、次の自分の手番に使う向き。自分の手番がまだ来ていなければ null */
    prepared: (): -1 | 1 | null => state.base ? null : state.facing,
  };
};
export type MovePredictor = ReturnType<typeof createMovePredictor>;
