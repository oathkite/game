// 実際の物理計算で確認した解法。最少弾数の保証ではなく、規定弾数で解けることの証拠。
export const SOLUTIONS = [
  [{ move: 0, slot: 1, elevation: 24, power: 80 }],
  [{ move: 0, slot: 1, elevation: 60, power: 86 }],
  [{ move: 0, slot: 1, elevation: 46, power: 70 }],
  [{ move: 0, slot: 0, elevation: 64, power: 96 }],
  [{ move: 15, slot: 1, elevation: 40, power: 100 }],
  [{ move: 0, slot: 0, elevation: 32, power: 82 }],
  [{ move: 0, slot: 0, elevation: 10, power: 46 }, { move: 0, slot: 0, elevation: 10, power: 68 }, { move: 0, slot: 0, elevation: 12, power: 92 }],
  [{ move: 0, slot: 0, elevation: 40, power: 76 }, { move: 0, slot: 0, elevation: 62, power: 100 }, { move: 0, slot: 1, elevation: 42, power: 82 }],
] as const;
