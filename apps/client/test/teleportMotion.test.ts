import { expect, it } from "vitest";
import { REPLAY_SETTLE_MS, TELEPORT_HOLD_MS } from "@game/engine/replay-timing";
import { TELEPORT_ARRIVE_MS, TELEPORT_DEPART_MS, TELEPORT_FX_MS, TELEPORT_WHITE_MS, teleportPoseAt } from "../src/game/teleportMotion";

// テレポートの機体の見え方（設計書 42.3）。着弾の瞬間を 0 として、撃った位置で白く光って消え、光の柱の中に白い姿で現れて色が戻る

it("着弾までは撃った位置にいて、着弾で白く光り、消えて、着地点に白く現れてから色が戻る", () => {
  expect(teleportPoseAt(-1)).toEqual({ at: "from", white: false });
  expect(teleportPoseAt(0)).toEqual({ at: "from", white: true });
  expect(teleportPoseAt(TELEPORT_DEPART_MS)).toEqual({ at: "hidden", white: false });
  expect(teleportPoseAt(TELEPORT_ARRIVE_MS)).toEqual({ at: "to", white: true });
  expect(teleportPoseAt(TELEPORT_ARRIVE_MS + TELEPORT_WHITE_MS)).toEqual({ at: "to", white: false });
});

it("動きを減らす設定では白くせず、着弾の瞬間に着地点へ移る", () => {
  expect(teleportPoseAt(-1, true)).toEqual({ at: "from", white: false });
  expect(teleportPoseAt(0, true)).toEqual({ at: "to", white: false });
});

it("演出は、オンラインの再生が着弾の後に残す長さに収まる", () => {
  expect(TELEPORT_ARRIVE_MS + TELEPORT_WHITE_MS).toBeLessThan(TELEPORT_FX_MS);
  expect(TELEPORT_FX_MS).toBeLessThanOrEqual(REPLAY_SETTLE_MS + TELEPORT_HOLD_MS);
});
