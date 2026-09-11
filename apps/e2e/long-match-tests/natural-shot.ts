import { applyOps, maskFromHeights, simulateConcurrentCombat } from "@game/sim";
import type { LabFrame } from "@game/protocol/v2-lab";

export const chooseNaturalShot = (frame: LabFrame) => {
  const shooter = frame.players.find(player => player.playerId === frame.actorId)!;
  const mask = applyOps(maskFromHeights(frame.map.surface, frame.map.height), frame.terrainOps);
  const combatants = frame.players.map(player => ({ ...player, hp: player.eliminated ? 0 : player.hp }));
  let best = { score: -Infinity, slot: 0, facing: 1, elevation: 45, power: 50 };
  for (const slot of [0, 1] as const) for (const facing of [-1, 1] as const) {
    for (const elevation of [15, 30, 45, 60, 75]) for (let power = 10; power <= 100; power += 10) {
      const outcome = simulateConcurrentCombat(mask, combatants, { x: shooter.x, y: shooter.y, facing, elevation, power, wind: frame.wind, weapon: shooter.loadout![slot] });
      const score = frame.players.reduce((sum, player, i) => {
        if (player.eliminated) return sum;
        const damage = player.hp - outcome.hpAfter[i]! + (outcome.ringOut.includes(i) ? 150 : 0);
        return sum + damage * (player.teamId === shooter.teamId ? -2 : 1);
      }, outcome.impacts.length * 0.001);
      if (score > best.score) best = { score, slot, facing, elevation, power };
    }
  }
  return best;
};
