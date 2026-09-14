import type { LabFrame } from "@game/protocol/v2-lab";
export const resultTitle = (result: LabFrame["result"], ownTeam?: string) => {
  if (result.type === "draw") return "引き分け";
  if (result.type !== "win" || ownTeam === undefined) return "対戦結果";
  return result.teamId === ownTeam ? "勝利" : "敗北";
};
