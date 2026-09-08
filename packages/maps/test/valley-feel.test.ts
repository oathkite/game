import { getMap } from "../src/index.js";
import { describe, expect, it } from "vitest";
import { damageDealtTo, isRingOut, simulateShot, STEPS_PER_TURN, surfaceY, walk, type TerrainMask } from "@game/sim";
import { MAP_NAMES, type MapName } from "@game/protocol";

// 設計書 07 の開発順序 4「谷で遊び、面白さを確認する」の数値による裏付け。
// 遊びの判断そのものは人が行うが、設計書 01 の判断基準「風を読み切って狙った場所に当てた報い」が成り立つ条件を固定する。
// 谷のスポーンから相手に届く照準の数が、風 0 と風 10 で大きく入れ替わることを確認する。

const valley = getMap("valley");

// 照準の格子（仰角 20 から 80、パワー 40 から 100）で、スポーンから相手に届く数を数える。谷も追加した 5 枚も同じ格子で測る。

type Aim = { readonly elevation: number; readonly power: number };

const aims: readonly Aim[] = Array.from({ length: 61 * 61 }, (_, i) => ({ elevation: 20 + Math.floor(i / 61), power: 40 + (i % 61) }));

// simulateShot は入力のマスクを変えないので、マップごとに 1 回だけ作って使い回す
const masks = new Map<MapName, TerrainMask>();
const maskOf = (name: MapName) => {
  const cached = masks.get(name);
  if (cached) return cached;
  const built = getMap(name).build();
  masks.set(name, built);
  return built;
};

const shotFrom = (name: MapName, from: 0 | 1, aim: Aim, weapon: "cannon" | "digger" = "cannon", wind = 0) => {
  const [x0, x1] = getMap(name).spawns;
  return simulateShot(maskOf(name), [{ x: x0, hp: 100 }, { x: x1, hp: 100 }], { seat: from, weapon, x: from === 0 ? x0 : x1, facing: from === 0 ? 1 : -1, elevation: aim.elevation, power: aim.power, wind });
};

const hittingFrom = (name: MapName, from: 0 | 1, wind = 0): readonly Aim[] => aims.filter((a) => damageDealtTo(shotFrom(name, from, a, "cannon", wind).result, from === 0 ? 1 : 0) > 0);

const key = (a: Aim): string => `${a.elevation}/${a.power}`;

const hitting = (wind: number): Set<string> => new Set(hittingFrom("valley", 0, wind).map(key));

describe("谷の手触り", () => {
  const calm = hitting(0);
  const gusty = hitting(10);

  it("無風でも当たる照準は全体の数パーセントに限られ、狙う価値がある", () => {
    const total = 61 * 61;
    expect(calm.size).toBeGreaterThan(20);
    expect(calm.size / total).toBeLessThan(0.1);
  });

  it("風 10 では無風の照準の大半が外れ、風を読み直す必要がある", () => {
    const survived = [...calm].filter((k) => gusty.has(k)).length;
    expect(survived / calm.size).toBeLessThan(0.5);
    expect(gusty.size).toBeGreaterThan(20);
  });

  it("当てた 1 発で相手の足元の地表が下がり、削って落とす勝ち筋が成立する", () => {
    const [x0, x1] = valley.spawns;
    const mask = valley.build();
    const surfaceAt = (m: typeof mask, x: number): number => {
      for (let y = 0; y < m.height; y++) if (m.cells[y * m.width + x] === 1) return y;
      return m.height;
    };
    // 当たる照準の中に、相手の真下の地表を下げるものがある
    const lowers = [...calm].some((k) => {
      const [elevation, power] = k.split("/").map(Number) as [number, number];
      const r = simulateShot(mask, [{ x: x0, hp: 100 }, { x: x1, hp: 100 }], { seat: 0, weapon: "cannon", x: x0, facing: 1, elevation, power, wind: 0 });
      return surfaceAt(r.mask, x1) > surfaceAt(mask, x1);
    });
    expect(lowers).toBe(true);
  });
});

// 1 ターンの移動が、地形に阻まれずに歩数どおり届くことを固定する。
// 歩数を増やしても崖や急斜面で頭打ちになるなら「移動を広げた」ことにならないためである。
describe("1 ターンで動ける範囲", () => {
  it("どのマップでも、スポーンから左右に歩数のぶんだけ地形に阻まれず歩ける", () => {
    for (const name of MAP_NAMES) {
      const map = getMap(name);
      const mask = map.build();
      for (const x of map.spawns) {
        for (const dir of [-1, 1] as const) {
          const r = walk(mask, x, dir, STEPS_PER_TURN);
          // どのマップのどちら向きで落ちたかが分かるよう、場所を添えて比べる
          expect({ where: `${name} x=${x} dir=${dir}`, ...r }).toEqual({
            where: `${name} x=${x} dir=${dir}`,
            x: x + dir * STEPS_PER_TURN,
            stepsUsed: STEPS_PER_TURN,
            fell: false,
          });
        }
      }
    }
  });

  it("谷では、動ける幅が両者の間合いの半分を超えない", () => {
    const [x0, x1] = valley.spawns;
    // 間合いの半分を超えて動けると、相手の真上へ回り込めてしまい撃ち合いにならない
    expect(STEPS_PER_TURN).toBeLessThan((x1 - x0) / 2);
  });
});

describe("平原の手触り", () => {
  const calm = hittingFrom("plain", 0);

  it("遮蔽がなくても間合いが遠いので、当たる照準は谷と同じく全体の 1 割未満", () => {
    expect(calm.length).toBeGreaterThan(20);
    expect(calm.length / aims.length).toBeLessThan(0.1);
  });

  it("風 10 では無風の照準の大半が外れる", () => {
    const gusty = new Set(hittingFrom("plain", 0, 10).map(key));
    const survived = calm.filter((a) => gusty.has(key(a))).length;
    expect(survived / calm.length).toBeLessThan(0.5);
  });
});

describe("段丘の手触り", () => {
  it("高台側が有利だが、低地側からも高台側の半分以上の照準が届く", () => {
    const high = hittingFrom("terrace", 0).length;
    const low = hittingFrom("terrace", 1).length;
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThanOrEqual(high / 2);
  });
});

describe("橋の手触り", () => {
  const bridge = getMap("bridge");

  it("スポーンから 2 ターン歩けば橋の上に出て、橋の上は落ちない", () => {
    const mask = bridge.build();
    const first = walk(mask, bridge.spawns[0], 1, STEPS_PER_TURN);
    const second = walk(mask, first.x, 1, STEPS_PER_TURN);
    expect(second.fell).toBe(false);
    expect(second.x).toBeGreaterThanOrEqual(150);
  });

  it("標準砲 1 発で橋が切れ、切れた所を歩くと落ちる", () => {
    const cut = aims.map((a) => shotFrom("bridge", 0, a)).find((r) => isRingOut(r.mask, 200));
    expect(cut).toBeDefined();
    if (!cut) return;
    expect(isRingOut(bridge.build(), 200)).toBe(false);
    expect(walk(cut.mask, 170, 1, STEPS_PER_TURN).fell).toBe(true);
  });
});

describe("洞窟の手触り", () => {
  it("高い弾道は天井に当たり、低い弾道なら相手に届く", () => {
    const high = aims.filter((a) => a.elevation >= 60 && a.power >= 80).map((a) => shotFrom("cave", 0, a).result);
    const onCeiling = high.filter((r) => r.impacts.some((i) => i.cell.y <= 72 && i.cell.x >= 140 && i.cell.x <= 260));
    expect(onCeiling.length).toBeGreaterThan(high.length / 2);
    expect(hittingFrom("cave", 0).length).toBeGreaterThan(20);
  });
});

describe("双塔の手触り", () => {
  it("掘削弾で相手の台を抜くと相手は地面に落ちるが、リングアウトにはならない", () => {
    const towers = getMap("towers");
    const [, x1] = towers.spawns;
    const ground = surfaceY(towers.build(), 200);
    const dropped = aims.map((a) => shotFrom("towers", 0, a, "digger")).find((r) => surfaceY(r.mask, x1) >= ground - 1);
    expect(dropped).toBeDefined();
    if (!dropped) return;
    expect(isRingOut(dropped.mask, x1)).toBe(false);
  });
});
