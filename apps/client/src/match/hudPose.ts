import type { Facing, Seat } from "@game/protocol";
import type { MatchView } from "./types";

export type HudPose = { readonly x: number; readonly y: number; readonly facing: Facing };

const poseOf = (p: HudPose): HudPose => ({ x: p.x, y: p.y, facing: p.facing });

/**
 * HUD の角度と傾きに使う seat の機体の位置と向き。手番中は操作中の値、自分の射撃の再生中は撃った値、それ以外は確定した位置。
 * 再生中は確定した位置が手番の初めのままなので、撃った値を使わないと、向き直して撃った再生のあいだだけ角度が逆を向く。
 * 確定した位置の向きは、相手の手番に準備した向きがあればそれにする（設計書 30 章）
 */
export const hudPose = (view: MatchView, seat: Seat): HudPose | null => {
  if (view.control && view.mySeat === seat) return poseOf(view.control);
  const input = view.replay?.shot.input;
  if (input?.seat === seat) return poseOf(input);
  const player = view.players?.[seat];
  if (!player) return null;
  return { x: player.x, y: player.y, facing: (seat === view.mySeat ? view.preparedFacing : null) ?? player.facing };
};
