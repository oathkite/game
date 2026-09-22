import type { Loadout } from "@game/protocol";
import { createMask, type TerrainMask } from "@game/sim";
import type { Target } from "./rules";

// 長方形の足場を重ねる。オンライン用の固定マップとは独立したパズル地形。
type Platform = readonly [left: number, top: number, right: number, bottom: number];
export type ChallengeStage = {
  readonly id: string;
  readonly title: string;
  readonly hint: string;
  readonly shots: number;
  readonly wind: number;
  readonly loadout: Loadout;
  readonly start: readonly [number, number];
  readonly platforms: readonly Platform[];
  readonly targets: readonly (readonly [number, number])[];
};
const floor: Platform = [0, 180, 399, 224];
export const STAGES: readonly ChallengeStage[] = [
  { id: "01", title: "はじめの一発", hint: "上下で角度を調整。発射を押し続け、離して撃とう。", shots: 5, wind: 0, loadout: ["cannon", "triple"], start: [60, 180], platforms: [floor], targets: [[180, 180]] },
  { id: "02", title: "丘の向こう", hint: "砲を上に向けて、壁の向こうへ撃ち上げよう。", shots: 5, wind: 0, loadout: ["cannon", "triple"], start: [60, 180], platforms: [floor, [155, 110, 180, 179]], targets: [[255, 180]] },
  { id: "03", title: "まとめて一発", hint: "的の間を狙えば、一つの爆風でまとめて壊せる。", shots: 4, wind: 0, loadout: ["cannon", "triple"], start: [60, 180], platforms: [floor], targets: [[195, 180], [205, 180], [215, 180]] },
  { id: "04", title: "足元が弱点", hint: "掘削弾で細い足場を崩そう。的は落ちても壊れる。", shots: 4, wind: 0, loadout: ["digger", "cannon"], start: [60, 180], platforms: [floor, [205, 120, 213, 179]], targets: [[209, 120]] },
  { id: "05", title: "撃つ場所を変えよう", hint: "左右で移動。屋根から出ると、上へ撃ちやすくなる。", shots: 5, wind: 0, loadout: ["cannon", "floater"], start: [60, 180], platforms: [floor, [30, 158, 85, 164], [190, 120, 230, 179]], targets: [[210, 120]] },
  { id: "06", title: "風に乗せて", hint: "葉で風を読もう。風はやり直しても同じ。", shots: 5, wind: 6, loadout: ["cannon", "floater"], start: [60, 180], platforms: [floor], targets: [[260, 180]] },
  { id: "07", title: "道を開け", hint: "壁を削って射線を作ろう。武器はいつでも切り替えられる。", shots: 5, wind: 0, loadout: ["digger", "cannon"], start: [100, 180], platforms: [floor, [130, 0, 151, 179], [152, 0, 399, 125]], targets: [[190, 180]] },
  { id: "08", title: "最後の三つ", hint: "位置と武器を使い分けよう。足場を崩す作戦も有効。", shots: 6, wind: -3, loadout: ["cannon", "digger"], start: [60, 180], platforms: [floor, [170, 145, 178, 179], [270, 120, 278, 179]], targets: [[174, 145], [230, 180], [274, 120]] },
];

export const createStageMask = (stage: ChallengeStage): TerrainMask => {
  const mask = createMask(400, 225);
  for (const [left, top, right, bottom] of stage.platforms) {
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) mask.cells[y * mask.width + x] = 1;
    }
  }
  return mask;
};

export const createTargets = (stage: ChallengeStage): readonly Target[] =>
  stage.targets.map(([x, y], index) => ({ id: `${stage.id}-${index}`, x, y, destroyed: false }));
