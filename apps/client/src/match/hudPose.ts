import type { Facing, Seat } from "@game/protocol";
import type { MatchView } from "./types";

export type HudPose = { readonly x: number; readonly y: number; readonly facing: Facing };

/**
 * HUD の角度と傾きに使う seat の機体の位置と向き。手番中は操作中の値、自分の射撃の再生中は撃った値、それ以外は確定した位置。
 * 再生中は確定した位置が手番の初めのままなので、撃った値を使わないと、向き直して撃った再生のあいだだけ角度が逆を向く
 */
export const hudPose = (view: MatchView, seat: Seat): HudPose | null => {
  const input = view.replay?.shot.input;
  const pose = view.control && view.mySeat === seat ? view.control : input?.seat === seat ? input : view.players?.[seat];
  return pose ? { x: pose.x, y: pose.y, facing: pose.facing } : null;
};
