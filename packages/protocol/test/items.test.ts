import { describe, expect, it } from "vitest";
import { actionCost, ITEM_IDS, isItemId, itemDelay, shotWeapon, TELEPORT_DELAY, WEAPON_DELAY, WEAPON_IDS } from "../src/index.js";

describe("アイテムの語彙", () => {
  it("ダブルシュートとテレポートの 2 つだけを受け付ける", () => {
    expect(ITEM_IDS).toEqual(["double", "teleport"]);
    expect(isItemId("double")).toBe(true);
    expect(isItemId("teleport")).toBe(true);
    for (const v of ["", "Double", "cannon", null, undefined, 0, {}]) expect(isItemId(v)).toBe(false);
  });

  it("テレポートの手番は選んだ武器に関わらず標準砲で撃ち、それ以外は選んだ武器のまま", () => {
    for (const weapon of WEAPON_IDS) {
      expect(shotWeapon(weapon, "teleport")).toBe("cannon");
      expect(shotWeapon(weapon, "double")).toBe(weapon);
      expect(shotWeapon(weapon)).toBe(weapon);
    }
  });
});

describe("アイテムの行動コスト（設計書 42.4）", () => {
  it("ダブルシュートは撃った武器のコストをもう一度足す", () => {
    for (const weapon of WEAPON_IDS) {
      expect(itemDelay("double", weapon)).toBe(WEAPON_DELAY[weapon]);
      expect(actionCost(10, weapon, "double")).toBe(actionCost(10, weapon) + WEAPON_DELAY[weapon]);
    }
    expect(actionCost(0, "cannon", "double")).toBe(110);
    expect(actionCost(30, "multiple", "double")).toBe(210);
  });

  it("テレポートは標準砲のコストに一律 40 を足す", () => {
    expect(TELEPORT_DELAY).toBe(40);
    expect(actionCost(0, shotWeapon("multiple", "teleport"), "teleport")).toBe(120);
    // 選んだ武器のまま渡しても、標準砲として数える
    for (const weapon of WEAPON_IDS) expect(actionCost(0, weapon, "teleport")).toBe(120);
    expect(actionCost(12, "cannon", "teleport")).toBe(132);
  });

  it("アイテムを使わない手番と撃たなかった手番のコストは変わらない", () => {
    expect(actionCost(10, "cannon")).toBe(90);
    expect(actionCost(10, "multiple")).toBe(125);
    expect(actionCost(0)).toBe(115);
    expect(actionCost(0, undefined, "double")).toBe(115);
  });
});
