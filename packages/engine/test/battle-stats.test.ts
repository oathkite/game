import { expect, it } from "vitest";
import { recordShotStats } from "../src/multiplayer/stats";
const members = [{ playerId: "a", teamId: "red" }, { playerId: "b", teamId: "red" }, { playerId: "c", teamId: "blue" }];
it("separates enemies, allies and self, capping multi-impact damage at remaining HP", () => {
  const before = { a: { shots: 1, enemyDamage: 5, friendlyDamage: 0, selfDamage: 0 } };
  const next = recordShotStats(before, members, "a", [{ playerId: "a", hp: 100 }, { playerId: "b", hp: 20 }, { playerId: "c", hp: 40 }], [{ damage: [{ playerId: "a", amount: 3 }, { playerId: "b", amount: 30 }, { playerId: "c", amount: 30 }] }, { damage: [{ playerId: "c", amount: 30 }] }]);
  expect(next.a).toEqual({ shots: 2, enemyDamage: 45, friendlyDamage: 20, selfDamage: 3 });
  expect(before.a.enemyDamage).toBe(5);
});
it("counts a miss as a shot, not damage", () => {
  expect(recordShotStats({}, members, "a", [], []).a).toEqual({ shots: 1, enemyDamage: 0, friendlyDamage: 0, selfDamage: 0 });
});
