import { MAP_NAMES, RANDOM_MAP, type MapChoice, type MapName } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { heightsFromProfile, merge, slabs, solidBelow } from "./profile.js";

// 設計書 02 の 2.9 の 8 枚。形状はコードで生成し、PNG は持たない。

export type MapDefinition = {
  readonly name: MapName;
  /** 2 箇所のスポーン x。左と右。どの席がどちらに立つかは対戦開始時に engine が決める */
  readonly spawns: readonly [number, number];
  readonly build: () => TerrainMask;
};

/** 谷。中央が深く落ち込み、両者は左右の高台に立つ */
const valley: MapDefinition = {
  name: "valley",
  spawns: [75, 325],
  build: () =>
    solidBelow(
      heightsFromProfile([
        [0, 128],
        [30, 122],
        [80, 122],
        [110, 130],
        [140, 160],
        [170, 195],
        [200, 205],
        [230, 195],
        [260, 160],
        [290, 130],
        [320, 122],
        [370, 122],
        [399, 128],
      ]),
    ),
};

/** 山越え。中央に高い山があり、直接は狙えない */
const mountain: MapDefinition = {
  name: "mountain",
  spawns: [60, 340],
  build: () =>
    solidBelow(
      heightsFromProfile([
        [0, 168],
        [40, 162],
        [90, 162],
        [130, 150],
        [160, 100],
        [190, 45],
        [200, 38],
        [210, 45],
        [240, 100],
        [270, 150],
        [310, 162],
        [360, 162],
        [399, 168],
      ]),
    ),
};

/** 浮島。両者が細い島の上に立ち、下は奈落 */
const island: MapDefinition = {
  name: "island",
  spawns: [85, 314],
  build: () =>
    slabs([
      {
        top: [[30, 132], [50, 124], [120, 124], [140, 132]],
        bottom: [[30, 140], [50, 152], [120, 152], [140, 140]],
      },
      {
        top: [[259, 132], [279, 124], [349, 124], [369, 132]],
        bottom: [[259, 140], [279, 152], [349, 152], [369, 140]],
      },
      {
        top: [[175, 176], [190, 170], [210, 170], [225, 176]],
        bottom: [[175, 182], [190, 190], [210, 190], [225, 182]],
      },
    ]),
};

/** 平原。ほぼ平らで遮蔽がなく、間合いは山越えと同じ 280 で最も遠い。風と距離だけを読む基準の枚。当てた穴が次の遮蔽になる。
 * スポーン 40 / 360 では当たる照準が 12 しかなく、60 / 340 で谷の 6 割ほどになった */
const plain: MapDefinition = {
  name: "plain",
  spawns: [60, 340],
  build: () =>
    solidBelow(
      heightsFromProfile([
        [0, 150],
        [100, 148],
        [200, 152],
        [300, 148],
        [399, 150],
      ]),
    ),
};

/** 段丘。左が高台、右が低地で、中央に 1 段の踊り場。唯一の非対称マップで、席の有利不利を遊んで測る。
 * 高低差 70 では低地から 1 発も届かなかった。高低差 30 にし、低地のスポーンを段に寄せて、低地から届く照準を高台の 6 割にした */
const terrace: MapDefinition = {
  name: "terrace",
  spawns: [70, 300],
  build: () =>
    solidBelow(
      heightsFromProfile([
        [0, 120],
        [120, 120],
        [135, 135],
        [175, 135],
        [190, 150],
        [399, 150],
      ]),
    ),
};

/** 橋。左右の崖を、奈落の上の細い橋（厚さ 8）がつなぐ。渡れば間合いが詰まるが、橋を切られると落ちる */
const bridge: MapDefinition = {
  name: "bridge",
  spawns: [90, 310],
  build: () =>
    slabs([
      { top: [[0, 120], [150, 120]], bottom: [[0, 225], [150, 225]] },
      { top: [[150, 120], [250, 120]], bottom: [[150, 128], [250, 128]] },
      { top: [[250, 120], [399, 120]], bottom: [[250, 225], [399, 225]] },
    ]),
};

/** 洞窟。谷の上に中央 120 セルを覆う天井（厚さ 12）。山越えが天井に当たるので、低い弾道で撃つか天井を抜く */
const cave: MapDefinition = {
  name: "cave",
  spawns: [75, 325],
  build: () =>
    merge([
      solidBelow(
        heightsFromProfile([
          [0, 128],
          [30, 122],
          [80, 122],
          [110, 130],
          [140, 160],
          [170, 195],
          [200, 205],
          [230, 195],
          [260, 160],
          [290, 130],
          [320, 122],
          [370, 122],
          [399, 128],
        ]),
      ),
      slabs([{ top: [[140, 60], [260, 60]], bottom: [[140, 72], [260, 72]] }]),
    ]),
};

/** 双塔。平らな地面の上に、両者が薄い台（厚さ 10）の上に立つ。台を抜かれると地面へ落ちるが、落ちても死なない */
const towers: MapDefinition = {
  name: "towers",
  spawns: [75, 325],
  build: () =>
    merge([
      solidBelow(heightsFromProfile([[0, 190], [399, 190]])),
      slabs([
        { top: [[40, 130], [110, 130]], bottom: [[40, 140], [110, 140]] },
        { top: [[290, 130], [360, 130]], bottom: [[290, 140], [360, 140]] },
      ]),
    ]),
};

const definitions: Readonly<Record<MapName, MapDefinition>> = { valley, mountain, island, plain, terrace, bridge, cave, towers };

/** 部屋の設定を対戦のマップに解く。ランダムは rng で 8 枚から等確率に選ぶ。rng は [0, 1) を返す */
export const resolveMapChoice = (choice: MapChoice, rng: () => number): MapName => {
  if (choice !== RANDOM_MAP) return choice;
  const index = Math.min(MAP_NAMES.length - 1, Math.floor(rng() * MAP_NAMES.length));
  return MAP_NAMES[index] as MapName;
};

export const getMap = (name: MapName): MapDefinition => definitions[name];

export const allMaps = (): readonly MapDefinition[] => MAP_NAMES.map((n) => definitions[n]);

export { heightsFromProfile, merge, slabs, solidBelow, type ProfilePoint, type Slab } from "./profile.js";
export { columnsOfMask, decodeColumns, encodeColumns, simplify, slabsFromColumns, validateDrawing, type Drawing, type Run } from "./drawing.js";
