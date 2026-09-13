import type { LabFrame } from "@game/protocol/v2-lab";
/** Explicit allowlist: never serialize a connection, session, profile or full frame. */
export const matchDiagnostics = (frame: Pick<LabFrame, "matchId" | "turnId" | "eventSeq" | "phase" | "serverTime" | "build">): string => JSON.stringify({
  format: "keropod-match-diagnostics-v1",
  matchId: frame.matchId,
  turnId: frame.turnId,
  eventSeq: frame.eventSeq,
  phase: frame.phase,
  serverTime: frame.serverTime,
  build: {
    protocol: frame.build.protocol, sim: frame.build.sim, rules: frame.build.rules, assets: frame.build.assets,
    map: { id: frame.build.map.id, version: frame.build.map.version },
  },
}, null, 2);
