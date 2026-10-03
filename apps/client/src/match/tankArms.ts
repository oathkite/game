import type { Loadout, WeaponId } from "@game/protocol";
import type { MatchView, PlayerView } from "./types";

// 機体に描く武器。撃つ武器を砲身に、装備のもう一方を車体後部のサブ武器に描く（設計書 10.5、43）。
// 自分の選択はすぐに反映し、ほかの参加者は最後に射撃で確定した武器を描く。まだ撃っていなければ装備の 1 つ目。

export type TankArms = { readonly weapon: WeaponId; readonly sub: WeaponId | null };

/** weapon を砲身に、装備のもう一方をサブ武器にする。装備に無い武器なら装備の 1 つ目をサブ武器にする */
export const armsOf = (loadout: Loadout, weapon: WeaponId): TankArms => ({ weapon, sub: loadout[0] === weapon ? loadout[1] : loadout[0] });

/** ほかの参加者の機体の武器 */
export const firedArms = (player: Pick<PlayerView, "loadout" | "lastWeapon">): TankArms => armsOf(player.loadout, player.lastWeapon ?? player.loadout[0]);

/** 対戦の表示状態から、席の機体の武器を決める。自分の席は操作中か最後に選んだスロット */
export const seatArms = (view: Pick<MatchView, "mySeat" | "control" | "lastSlot">, seat: number, player: Pick<PlayerView, "loadout" | "lastWeapon">): TankArms =>
  seat === view.mySeat ? armsOf(player.loadout, player.loadout[view.control?.slot ?? view.lastSlot]) : firedArms(player);
