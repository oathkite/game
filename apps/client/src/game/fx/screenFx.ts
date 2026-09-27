import { Graphics, type Container } from "pixi.js";
import { PALETTE } from "../palette";
import { createGradeFilter } from "./gradeFilter";
import { brighterHalf, composeTables, DIM_TABLE, TINT_PRIORITY, type GradeTable, type TintPriority } from "./gradeTables";

// 画面全体にかかる演出。設計書 41.6 の I5 と、41.13 の評価と改善。
// 暗転は、爆心の周りを残すスポットライトにし、外の地形と背景の色を 1 段暗いパレットの色へ置き換える。
// 空の色は、武器と大ダメージで置き換え表を当てる。どちらも置き換え表のフィルター（gradeFilter.ts）で、描く画素はパレットの色のまま。
// 強さを Bayer の市松で段に分けて戻すと空が網のように見えたので、入りと戻りの 70 ms だけ明るい半分の色を置き換える表を挟む。
// 撃破は全画面の白から入るので、入りの段を挟まない（挟むと、白の直後に元の夜空が 3 コマ見えた。評価の 4 回目）。
// 撃破の寄せは武器の寄せと別に持ち、重なったら撃破を当てる。
// 戦車、火球、粒、数字には当てない（暗転の手前に見える）。全画面の光は 34 ms（60 fps で 2 コマ）の白。

/** 色の寄せの入りと戻りの段の長さ（ms） */
export const TINT_EDGE_MS = 70;

/** 空の色の寄せ。entry が false なら入りの段を挟まない（全画面の白から入るとき。白が移り変わりの役を果たす） */
export type Tint = { readonly table: GradeTable; readonly from: number; readonly ms: number; readonly entry: boolean; readonly priority: TintPriority };

/** 次の寄せを受けたときの寄せ。同じ表が効いている間に続けて当たったら（レーザー弾の 7 段）、入りの段をやり直さずに終わりだけ延ばす。
 * やり直すと、段ごとに入りの段（明るい半分だけ）に戻り、最後の段の後にしか寄せが見えなかった */
export const nextTint = (current: Tint | null, next: Tint): Tint =>
  current !== null && current.table === next.table && next.from >= current.from && next.from <= current.from + current.ms
    ? { ...current, ms: Math.max(current.ms, next.from + next.ms - current.from) }
    : next;

/** 次の寄せを受けたときの寄せの組。優先度ごとに 1 つ持ち、同じ優先度の寄せとだけ nextTint で合わせる。
 * 1 つで持っていたときは、レーザー弾の後の段が予約中の撃破の寄せを置き換えて白の後に赤が出ず、撃破の予約が効いている武器の寄せを消していた */
export const nextTints = (tints: readonly Tint[], next: Tint): readonly Tint[] => [
  ...tints.filter((t) => t.priority !== next.priority),
  nextTint(tints.find((t) => t.priority === next.priority) ?? null, next),
];

/** now の寄せの段。効いていなければ null、入りと戻りの TINT_EDGE_MS は "edge"、その間は "full" */
export const tintPhaseAt = (tint: Tint | null, now: number): "edge" | "full" | null => {
  if (tint === null || now < tint.from || now >= tint.from + tint.ms) return null;
  const entering = tint.entry && now - tint.from < TINT_EDGE_MS, leaving = tint.from + tint.ms - now <= TINT_EDGE_MS;
  return entering || leaving ? "edge" : "full";
};

/** now に当てる寄せ。効いている寄せのうち優先度の高いもの。なければ null。
 * 上の寄せが入りか戻りの段にあり、下の寄せも効いていれば、下の寄せを当てる。明るい半分だけの段を挟むと、下の寄せとの間に元の空の色が見える */
export const shownTint = (tints: readonly Tint[], now: number): Tint | null => {
  const [top, below] = tints.filter((t) => tintPhaseAt(t, now) !== null).sort((a, b) => b.priority - a.priority);
  return top !== undefined && below !== undefined && tintPhaseAt(top, now) === "edge" ? below : top ?? null;
};
/** スポットライトの縁の市松の幅（セル） */
const DIM_EDGE_CELLS = 3;
/** 背景の 1 art px の画面の px（pixelBackdrop の PX と同じ） */
const BACKDROP_PX = 2;

export type ScreenFx = {
  /** stage の最前に置く全画面の光 */
  readonly flash: Graphics;
  /** from から ms の間、爆心（セル）の周り半径 radius（セル）を残して暗くする */
  readonly dimAt: (cx: number, cy: number, radius: number, from: number, ms: number) => void;
  /** at から ms の間、画面全体を白くする */
  readonly flashAt: (at: number, ms: number) => void;
  /** from から ms の間、空の色を表で置き換える。entry が false なら入りの段を挟まない。priority が高い寄せは、効いている間、低い寄せより先に当てる */
  readonly tintAt: (table: GradeTable, from: number, ms: number, entry?: boolean, priority?: TintPriority) => void;
  readonly tick: (now: number, screen: { readonly width: number; readonly height: number }) => void;
  readonly clear: () => void;
  readonly destroy: () => void;
};

type View = {
  /** 地形（セルで描く world の中）と背景（画面に固定） */
  readonly terrain: Container;
  readonly sky: Container;
  /** セルの座標を画面の px にする。スポットライトの中心に使う */
  readonly toScreen: (cx: number, cy: number) => { readonly x: number; readonly y: number };
  /** 1 セルの画面の px */
  readonly cell: () => number;
};

/** 表ごとの番号。フィルターに表を送り直すかを決める鍵に入れ、同じ時刻に別の表へ替わっても送り直す */
const tableIds = new WeakMap<GradeTable, number>();
let nextTableId = 0;
const tableId = (table: GradeTable): number => {
  const found = tableIds.get(table);
  if (found !== undefined) return found;
  const id = nextTableId++;
  tableIds.set(table, id);
  return id;
};

export const createScreenFx = (view: View): ScreenFx => {
  const terrainGrade = createGradeFilter(), skyGrade = createGradeFilter();
  const flash = new Graphics();
  flash.visible = false;
  let spot = { cx: 0, cy: 0, radius: 0, from: Infinity, until: -Infinity };
  let flashFrom = Infinity, flashUntil = -Infinity, tints: readonly Tint[] = [];
  let terrainKey = "", skyKey = "";
  const place = (target: Container, grade: typeof terrainGrade, key: string, table: GradeTable | null, strength: number, px: number, withSpot: boolean): string => {
    if (!table) { if (target.filters) target.filters = null; return ""; }
    if (key !== (target === view.terrain ? terrainKey : skyKey)) grade.setTable(table);
    const c = view.toScreen(spot.cx + 0.5, spot.cy + 0.5), cell = view.cell();
    grade.setSpot(c.x, c.y, withSpot ? spot.radius * cell : 0, DIM_EDGE_CELLS * cell);
    grade.setStrength(strength);
    grade.setPixel(px);
    if (!target.filters) target.filters = [grade.filter];
    return key;
  };
  return {
    flash,
    dimAt: (cx, cy, radius, from, ms) => { spot = { cx, cy, radius, from, until: from + ms }; },
    flashAt: (at, ms) => { flashFrom = at; flashUntil = at + ms; },
    tintAt: (table, from, ms, entry = true, priority = TINT_PRIORITY.weapon) => { tints = nextTints(tints, { table, from, ms, entry, priority }); },
    tick: (now, screen) => {
      const dimming = now >= spot.from && now < spot.until;
      terrainKey = place(view.terrain, terrainGrade, dimming ? "dim" : "", dimming ? DIM_TABLE : null, 1, view.cell() / 4, true);
      // 空は、暗転と色の寄せが重なったら続けて当てる。スポットライトは地形だけにする（空に残すと、寄せた空に元の色の円が浮いた）
      const tint = shownTint(tints, now), phase = tintPhaseAt(tint, now);
      const tintTable = tint !== null && phase !== null ? (phase === "edge" ? brighterHalf(tint.table) : tint.table) : null;
      const skyTable = dimming && tintTable ? composeTables(DIM_TABLE, tintTable) : dimming ? DIM_TABLE : tintTable;
      const key = `${dimming}/${phase && tint ? `${tableId(tint.table)}@${tint.from}` : ""}/${phase}`;
      skyKey = place(view.sky, skyGrade, key, skyTable, 1, BACKDROP_PX, false);
      const flashing = now >= flashFrom && now < flashUntil;
      if (flashing && !flash.visible) flash.clear().rect(0, 0, screen.width, screen.height).fill(PALETTE.white);
      flash.visible = flashing;
    },
    clear: () => {
      spot = { cx: 0, cy: 0, radius: 0, from: Infinity, until: -Infinity };
      flashFrom = Infinity; flashUntil = -Infinity; tints = [];
      view.terrain.filters = null; view.sky.filters = null; terrainKey = ""; skyKey = "";
      flash.visible = false;
    },
    destroy: () => { terrainGrade.destroy(); skyGrade.destroy(); },
  };
};
