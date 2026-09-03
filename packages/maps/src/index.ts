import { MAP_NAMES, type MapName } from "@game/protocol";
import type { TerrainMask } from "@game/sim";
import { heightsFromProfile, slabs, solidBelow } from "./profile.js";

// 設計書 02 の 2.9 の 3 枚。形状はコードで生成し、PNG は持たない。

export type MapDefinition = {
  readonly name: MapName;
  /** 2 箇所のスポーン x。左と右。どの席がどちらに立つかは対戦開始時に engine が決める */
  readonly spawns: readonly [number, number];
  readonly build: () => TerrainMask;
};

/** 谷。中央が深く落ち込み、両者は左右の高台に立つ */
const valley: MapDefinition = {
  name: "valley",
  spawns: [55, 345],
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

const definitions: Readonly<Record<MapName, MapDefinition>> = { valley, mountain, island };

export const getMap = (name: MapName): MapDefinition => definitions[name];

export const allMaps = (): readonly MapDefinition[] => MAP_NAMES.map((n) => definitions[n]);

export { heightsFromProfile, slabs, solidBelow, type ProfilePoint, type Slab } from "./profile.js";
