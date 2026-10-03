import type { TurretSkin } from "@game/protocol";
import { createGrid, setPixel, type PixelGrid } from "./pixelGrid";
import { MATERIAL as M } from "./tankShape";

// 砲塔のスキン。設計書 43。右向き、傾き 0、接地点が原点の art px に、ASCII の図で材質を置く。
// 砲身の付け根（0, −16）はどの砲塔でも図の中に入り、砲身はその後ろに隠れる。

const LEGEND: Readonly<Record<string, number>> = {
  h: M.hatch, L: M.turretLight, B: M.turretBase, S: M.turretShadow, D: M.turretDeep, w: M.shine,
  m: M.metalLight, n: M.metalBase, o: M.metalShadow, p: M.metalDeep,
  e: M.energyHot, c: M.energyCore, d: M.energyDeep,
  k: M.bomb, K: M.bombShine, f: M.fuse, s: M.spark,
  y: M.brassLight, Y: M.brass, Z: M.brassShadow, x: M.hole,
  r: M.warhead, R: M.warheadShadow,
};

/** ASCII の図を格子にする。left, top は図の左上の画素の座標、dx, dy はずらす量。"." は透明 */
export const sketch = (left: number, top: number, rows: readonly string[], dx = 0, dy = 0): PixelGrid => {
  const width = Math.max(...rows.map(r => r.length));
  const grid = createGrid(left + dx, top + dy, width, rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const m = LEGEND[ch];
    if (m !== undefined) setPixel(grid, left + x + dx, top + y + dy, m);
  }));
  return grid;
};

export type TurretArt = {
  readonly left: number;
  readonly top: number;
  readonly rows: readonly string[];
  /** アンテナの根元を上げる量（art px）。背の高い砲塔で、アンテナを砲塔の上に立たせる */
  readonly antennaLift: number;
};

// 武器を連想させる色（発光色、真鍮、爆弾の黒）は使わない。副色の 4 段と金属だけで形を作る。
// 図の左端はどれも x = −11。砲身の付け根（0, −16）は図の 12 列目、y = −16 の行に入る。
// 後ろの端は x ≥ −10 で止め、車体後部のサブ武器（x = −15〜−10）と重ねない
export const TURRET_ART: Readonly<Record<TurretSkin, TurretArt>> = {
  // 丸いドームに車長のキューポラと、前に張り出す砲の盾
  dome: { left: -11, top: -23, antennaLift: 2, rows: [
    "........hhh...........",
    ".......ohhho..........",
    ".....LLLLLLLLL........",
    "....LwwBBBBBBBBL......",
    "...BwBBBBBBBBBBBB.....",
    "...BBBBBBBBBBBBBSnnm..",
    "..BBBBBBBBBBBBBBSnnnn.",
    "..BBBBBBBBBBBBBSSnnoo.",
    "..SSSSSSSSSSSSSSSoop..",
    ".DDDDDDDDDDDDDDDDDD...",
  ] },
  // 平たく広い。側面に増加装甲の帯、前に発煙弾の筒
  wide: { left: -11, top: -20, antennaLift: 1, rows: [
    ".......hhhh...........",
    "...LLLLLLLLLLLLL......",
    "..BwwBBBBBBBBBBBB..mm.",
    ".BwBBBBBBBBBBBBBBBBnn.",
    ".BBBBBBBBBBBBBBBBBBB..",
    ".nnnnnnnnnnnnnnnnnnn..",
    "..SoSSoSSoSSoSSoSSo...",
  ] },
  // 角張った箱。前を斜めに落とし、側面に工具箱
  box: { left: -11, top: -22, antennaLift: 2, rows: [
    "..hhh.................",
    ".LLLLLLLLLLLLLLL......",
    ".BBBBBBBBBBBBBBBL.....",
    ".BoBoBoBBBBBBBBBBL....",
    ".BBBBBBBBBBBBBBBBBL...",
    ".BppppBBBBBBBBBBBBSnn.",
    ".BoooBBBBBBBBBBBBSSnn.",
    ".SSSSSSSSSSSSSSSSSSoo.",
    "..DDDDDDDDDDDDDDDDD...",
  ] },
  // 低く長い楔。前の増加装甲が砲身の下まで伸びる
  wedge: { left: -11, top: -21, antennaLift: 0, rows: [
    "..hhh..................",
    ".LLLLLL................",
    ".BBBBBBBLL.............",
    ".BBBBBBBBBLL...........",
    ".BBBBBBBBBBBLL.........",
    ".BBBBBBBBBBBBBLLnn.....",
    ".SSSSSSSSSSSSSSSSoonn..",
    "DDDDDDDDDDDDDDDDDDDD...",
  ] },
  // 後ろへ傾いた放熱のフィンと、横長の覗き窓
  fin: { left: -11, top: -25, antennaLift: 1, rows: [
    ".......mm.mm.mm.......",
    "......nmo.nmo.nmo.....",
    "......no..no..no......",
    "......n...n...n.......",
    "....LLLLLLLLLLL.......",
    "..BBBBBBBBBBBBBBB.....",
    ".BBppppppBBBBBBBBB....",
    ".BBBBBBBBBBBBBBBBSSn..",
    ".BBBBBBBBBBBBBBBSSSnn.",
    ".SSSSSSSSSSSSSSSSSSo..",
    "..DDDDDDDDDDDDDDDDD...",
  ] },
  // 寸胴の筒に、潜望鏡つきのキューポラ
  pot: { left: -11, top: -25, antennaLift: 1, rows: [
    "........hhhh..........",
    ".......ohhhho.........",
    ".......onmnno.........",
    ".......oLLLLo..m......",
    "..LLLLLLLLLLLLLn......",
    "..BBBBBBBBBBBBBBB.....",
    "..BoBBBBBBBBBBoBB.....",
    "..BBBBBBBBBBBBBBSnn...",
    "..BBBBBBBBBBBBBBSnn...",
    "..BBBBBBBBBBBBBSSoo...",
    "..SSSSSSSSSSSSSSSo....",
    ".DDDDDDDDDDDDDDDD.....",
  ] },
  // 背の高い玉ねぎに、頂の棘と丸いハッチ
  onion: { left: -11, top: -27, antennaLift: 4, rows: [
    ".........m............",
    ".........n............",
    "........LLL...........",
    "......LLLLLLL.........",
    ".....BBBBBBBBB........",
    "....BwBBBBBBBBB.......",
    "...BwBBoooBBBBBB......",
    "...BBBomnnoBBBBB......",
    "...BBBonnooBBBBB......",
    "...BBBBoooBBBBBBnn....",
    "...BBBBBBBBBBBBSnnn...",
    "...BBBBBBBBBBBSSnno...",
    "..SSSSSSSSSSSSSSSo....",
    ".DDDDDDDDDDDDDDDD.....",
  ] },
  // 低い多面体のステルス形と、センサーの柱
  flat: { left: -11, top: -24, antennaLift: 0, rows: [
    "........oo............",
    ".......onmn...........",
    "........oo............",
    ".........p............",
    ".........p............",
    "...LLLLLLLLLLLLLL.....",
    "..BBBBBBBBBBBBBBBBL...",
    ".BBBBBBBBBBBBBBBBSSSL.",
    ".SSSSSSSSSSSSSSSSSSSS.",
    "..DDDDDDDDDDDDDDDDDD..",
    "...DDDDDDDDDDDDDDDD...",
  ] },
};

/** 砲塔の格子。残骸は前へ崩れて 1 px ずれ、3 px 沈む */
export const turretGrid = (skin: TurretSkin, sink: number, wrecked: boolean): PixelGrid => {
  const art = TURRET_ART[skin];
  return sketch(art.left, art.top, art.rows, wrecked ? 1 : 0, sink + (wrecked ? 3 : 0));
};
