import { hasClearance, isRingOut, maskFromHeights, spawnPos, TANK_RADIUS, type TankPos, type TerrainMask } from "@game/sim";

/** 登録済み定義用。公開用の編成・射程検証を終えるまではtest-onlyとして扱う。 */
export type MapSpec = {
  readonly id: string;
  readonly version: number;
  readonly width: number;
  readonly height: number;
  readonly status: "test-only";
  readonly surface: readonly number[];
  readonly spawns: Readonly<Partial<Record<number, readonly number[]>>>;
};

export const TEST_ARENA: MapSpec = {
  id: "multiplayer-test-arena", version: 1, width: 500, height: 225, status: "test-only",
  surface: Array.from({ length: 500 }, () => 150),
  spawns: {
    2: [110, 389],
    3: [110, 250, 389],
    4: [110, 180, 319, 389],
    5: [110, 180, 250, 319, 389],
    6: [110, 165, 220, 279, 334, 389],
    7: [110, 155, 200, 250, 299, 344, 389],
    8: [110, 150, 190, 230, 269, 309, 349, 389],
  },
};

export const buildMapSpec = (spec: MapSpec, count: number): { readonly mask: TerrainMask; readonly spawns: readonly TankPos[] } => {
  if (!spec.id.trim() || !Number.isInteger(spec.version) || spec.version < 1) throw new Error("invalid map identity");
  if (!Number.isInteger(spec.width) || spec.width < 1 || spec.width > 500 || !Number.isInteger(spec.height) || spec.height < 1 || spec.height > 225) {
    throw new Error("map dimensions exceed validated bounds");
  }
  if (spec.surface.length !== spec.width || spec.surface.some(y => !Number.isInteger(y) || y < 0 || y > spec.height)) throw new Error("invalid surface");
  const xs = spec.spawns[count];
  if (!Number.isInteger(count) || count < 2 || count > 8 || !xs || xs.length !== count) throw new Error("unsupported player count");
  if (xs.some((x, i) => !Number.isInteger(x) || x < TANK_RADIUS || x >= spec.width - TANK_RADIUS || xs.slice(0, i).some(other => Math.abs(other - x) < TANK_RADIUS * 2))) {
    throw new Error("invalid or overlapping spawns");
  }
  const mask = maskFromHeights(spec.surface, spec.height);
  const spawns = xs.map(x => spawnPos(mask, x));
  if (spawns.some(p => isRingOut(mask, p) || p.y < TANK_RADIUS * 2 || !hasClearance(mask, p.x, p.y))) throw new Error("unsafe spawn");
  return { mask, spawns };
};
