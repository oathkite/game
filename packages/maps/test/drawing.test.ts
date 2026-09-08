import { MAP_NAMES } from "@game/protocol";
import { describe, expect, it } from "vitest";
import { columnsOfMask, decodeColumns, encodeColumns, getMap, heightsFromProfile, simplify, slabs, slabsFromColumns, validateDrawing } from "../src/index.js";

// お絵かきツールの受け側。絵（列ごとの帯）から作った板が、元のマスクをセル単位で再現することを固定する。

describe("drawing", () => {
  it("8 枚すべてが 列の帯 → 板 → マスク で元と一致する（往復）", () => {
    for (const name of MAP_NAMES) {
      const mask = getMap(name).build();
      const columns = columnsOfMask(mask);
      const rebuilt = slabs(slabsFromColumns(columns));
      expect(Buffer.from(rebuilt.cells).equals(Buffer.from(mask.cells)), name).toBe(true);
    }
  });

  it("文字列の往復", () => {
    const columns = columnsOfMask(getMap("cave").build());
    expect(decodeColumns(encodeColumns(columns))).toEqual(columns);
  });

  it("simplify は補間が同じ値を返す範囲で頂点を減らし、元の値を再現する", () => {
    const values = heightsFromProfile([[0, 100], [10, 110], [30, 110], [40, 90], [399, 90]]);
    const points = simplify(values, 0);
    expect(points).toEqual([[0, 100], [10, 110], [30, 110], [40, 90], [399, 90]]);
    expect(heightsFromProfile(points)).toEqual(values);
  });

  it("洞窟のような 1 列に帯が 2 つある地形は 2 枚以上の板になる", () => {
    const n = slabsFromColumns(columnsOfMask(getMap("cave").build())).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(3);
  });

  it("1 列だけの板（細い柱）も消えずに再現する", () => {
    const columns = Array.from({ length: 400 }, (_, x) => (x === 200 ? [[100, 120] as const, [200, 225] as const] : [[200, 225] as const]));
    const rebuilt = slabs(slabsFromColumns(columns));
    expect(rebuilt.cells[110 * 400 + 200]).toBe(1);
    expect(columnsOfMask(rebuilt)).toEqual(columns);
  });

  it("validateDrawing は列数と帯の順序とスポーンと整数性を検査する", () => {
    const ok = { name: "t", spawns: [10, 390] as const, columns: columnsOfMask(getMap("valley").build()) };
    expect(validateDrawing(ok)).toEqual([]);
    expect(validateDrawing({ ...ok, columns: ok.columns.slice(1) }).length).toBe(1);
    expect(validateDrawing({ ...ok, spawns: [-1, 400] }).length).toBe(2);
    const bad = ok.columns.map((c, x) => (x === 5 ? [[50, 40] as const] : c));
    expect(validateDrawing({ ...ok, columns: bad }).length).toBe(1);
    const fractional = ok.columns.map((c, x) => (x === 5 ? [[5.5, 20.25] as const] : c));
    expect(validateDrawing({ ...ok, columns: fractional }).length).toBe(1);
    const nan = ok.columns.map((c, x) => (x === 5 ? decodeColumns("a-b")[0] ?? [] : c));
    expect(validateDrawing({ ...ok, columns: nan }).length).toBe(1);
  });
});
