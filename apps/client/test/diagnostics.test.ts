import { expect, it } from "vitest";
import { CLIENT_BUILD } from "@game/protocol/build";
import { matchDiagnostics } from "../src/worldUi/diagnostics";
it("exports only public match identity and build fields, even when supplied extra private properties", () => {
  const input = { matchId: "match", turnId: 7, eventSeq: 31, phase: "acting" as const, serverTime: 1234,
    token: "secret", nickname: "private name", power: 53, elevation: 47,
    build: { ...CLIENT_BUILD, secret: "nested secret", map: { id: "moss-valley", version: 1, secret: "map secret" } } };
  const exported = JSON.parse(matchDiagnostics(input));
  expect(exported).toEqual({ format: "keropod-match-diagnostics-v1", matchId: "match", turnId: 7, eventSeq: 31,
    phase: "acting", serverTime: 1234, build: { ...CLIENT_BUILD, map: { id: "moss-valley", version: 1 } } });
  expect(matchDiagnostics(input)).not.toMatch(/secret|nickname|power|elevation/);
});
