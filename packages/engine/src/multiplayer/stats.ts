import type { RosterMember } from "./rules.js";
export type PlayerStats = { readonly shots: number; readonly enemyDamage: number; readonly friendlyDamage: number; readonly selfDamage: number };
export type BattleStats = Readonly<Record<string, PlayerStats>>;
export const recordShotStats = (stats: BattleStats, members: readonly RosterMember[], shooterId: string,
  players: readonly { readonly playerId: string; readonly hp: number }[], impacts: readonly { readonly damage: readonly { readonly playerId: string; readonly amount: number }[] }[]): BattleStats => {
  const team = members.find(p => p.playerId === shooterId)!.teamId;
  const damage = players.reduce((sum, player) => {
    const amount = Math.min(Math.max(0, player.hp), impacts.reduce((total, impact) => total + (impact.damage.find(d => d.playerId === player.playerId)?.amount ?? 0), 0));
    const key = player.playerId === shooterId ? "selfDamage" : members.find(p => p.playerId === player.playerId)!.teamId === team ? "friendlyDamage" : "enemyDamage";
    return { ...sum, [key]: sum[key] + amount };
  }, { enemyDamage: 0, friendlyDamage: 0, selfDamage: 0 });
  const previous = stats[shooterId] ?? { shots: 0, enemyDamage: 0, friendlyDamage: 0, selfDamage: 0 };
  return { ...stats, [shooterId]: { shots: previous.shots + 1, enemyDamage: previous.enemyDamage + damage.enemyDamage,
    friendlyDamage: previous.friendlyDamage + damage.friendlyDamage, selfDamage: previous.selfDamage + damage.selfDamage } };
};
