import { MAP_HEIGHT, MAP_WIDTH, type TerrainMask } from "@game/sim";
import { heightsFromProfile, type ProfilePoint, type Slab } from "./profile.js";

// お絵かきツール（docs/design/02 の 2.8）で描いた地形を、頂点の列（板の集まり）へ変換する。
// 実行時には絵を読まない。開発時に scripts/import-drawing.ts がこの関数で TypeScript の定義を出力する。

/** 1 列の地面の帯。top 以上 bottom 未満が地面 */
export type Run = readonly [top: number, bottom: number];

/** 描いた地形。columns は x ごとの帯の列（帯は上から順） */
export type Drawing = {
  readonly name: string;
  readonly spawns: readonly [number, number];
  /** スポーンの探索開始 y。省略は 0 */
  readonly spawnFromY?: readonly [number, number];
  readonly columns: readonly (readonly Run[])[];
};

/** 列ごとの帯を文字列にする。列は ";" で区切り、帯は "top-bottom" を "," で並べる。空の列は空文字 */
export const encodeColumns = (columns: readonly (readonly Run[])[]): string => columns.map((runs) => runs.map(([t, b]) => `${t}-${b}`).join(",")).join(";");

export const decodeColumns = (text: string): Run[][] =>
  text.split(";").map((col) =>
    col.length === 0
      ? []
      : col.split(",").map((run) => {
          const [t, b] = run.split("-").map(Number) as [number, number];
          return [t, b] as const;
        }),
  );

/** マスクから列ごとの帯を取る。ツールに既存のマップを読み込ませるときと、往復のテストに使う */
export const columnsOfMask = (mask: TerrainMask): Run[][] => {
  const out: Run[][] = [];
  for (let x = 0; x < mask.width; x++) {
    const runs: Run[] = [];
    let top = -1;
    for (let y = 0; y <= mask.height; y++) {
      const solid = y < mask.height && mask.cells[y * mask.width + x] === 1;
      if (solid && top < 0) top = y;
      if (!solid && top >= 0) {
        runs.push([top, y]);
        top = -1;
      }
    }
    out.push(runs);
  }
  return out;
};

const overlaps = (a: Run, b: Run): boolean => a[0] < b[1] && b[0] < a[1];

type OpenSlab = { x0: number; tops: number[]; bottoms: number[]; last: Run };

/**
 * 列ごとの帯を板に分ける。隣の列で縦に重なる帯を同じ板とみなし、重ならなくなったら板を閉じる。
 * 1 列に同じ板の帯が 2 つ来ることはない（上から見て最初に重なる帯を続け、残りは新しい板）
 */
export const slabsFromColumns = (columns: readonly (readonly Run[])[]): Slab[] => {
  const closed: Slab[] = [];
  let open: OpenSlab[] = [];
  columns.forEach((runs, x) => {
    const next: OpenSlab[] = [];
    const taken = new Set<number>();
    for (const slab of open) {
      const i = runs.findIndex((r, j) => !taken.has(j) && overlaps(r, slab.last));
      if (i < 0) {
        closed.push(finish(slab));
        continue;
      }
      taken.add(i);
      const run = runs[i] as Run;
      slab.tops.push(run[0]);
      slab.bottoms.push(run[1]);
      slab.last = run;
      next.push(slab);
    }
    runs.forEach((run, j) => {
      if (!taken.has(j)) next.push({ x0: x, tops: [run[0]], bottoms: [run[1]], last: run });
    });
    open = next;
  });
  for (const slab of open) closed.push(finish(slab));
  return closed;
};

const finish = (slab: OpenSlab): Slab => ({ top: simplify(slab.tops, slab.x0), bottom: simplify(slab.bottoms, slab.x0) });

/**
 * x0 から始まる列ごとの値を、heightsFromProfile が同じ値を返す範囲で貪欲に延ばして頂点を減らす。
 * 補間（切り捨て）が 1 列でもずれたら手前で頂点を置く。最少とは限らないが、元の値は必ず再現する。
 * 1 列だけの板は同じ x の頂点 2 つにする（heightsFromProfile は span 0 を y0 として扱う）
 */
export const simplify = (values: readonly number[], x0: number): ProfilePoint[] => {
  const first = values[0] as number;
  if (values.length === 1) return [[x0, first], [x0, first]];
  const points: ProfilePoint[] = [[x0, first]];
  let start = 0;
  while (start < values.length - 1) {
    let end = start + 1;
    while (end + 1 < values.length && reproduces(values, x0, start, end + 1)) end++;
    points.push([x0 + end, values[end] as number]);
    start = end;
  }
  return points;
};

const reproduces = (values: readonly number[], x0: number, start: number, end: number): boolean => {
  const y0 = values[start] as number;
  const y1 = values[end] as number;
  const span = end - start;
  for (let i = start + 1; i < end; i++) {
    if (y0 + Math.floor(((y1 - y0) * i - (y1 - y0) * start) / span) !== values[i]) return false;
  }
  return true;
};

/** 絵の妥当性。幅は 400 列、帯は整数で 0 以上 225 以下、上から順に重ならない */
export const validateDrawing = (d: Drawing): string[] => {
  const errors: string[] = [];
  if (d.columns.length !== MAP_WIDTH) errors.push(`列の数が ${d.columns.length}（${MAP_WIDTH} でなければならない）`);
  d.columns.forEach((runs, x) => {
    let prev = 0;
    for (const [t, b] of runs) {
      if (!Number.isInteger(t) || !Number.isInteger(b) || t < prev || b <= t || b > MAP_HEIGHT) errors.push(`x=${x} の帯 ${t}-${b} が不正`);
      prev = b;
    }
  });
  for (const s of d.spawns) if (!Number.isInteger(s) || s < 0 || s >= MAP_WIDTH) errors.push(`スポーン x=${s} が範囲外`);
  for (const y of d.spawnFromY ?? []) if (!Number.isInteger(y) || y < 0 || y >= MAP_HEIGHT) errors.push(`スポーンの探索開始 y=${y} が範囲外`);
  return errors;
};
