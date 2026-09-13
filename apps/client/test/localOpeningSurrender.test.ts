import { expect, it } from "vitest";
import type { ServerMessage } from "@game/protocol";
import { createLocalConnection } from "../src/net/localConnection";

it("honors practice surrender while the opening is holding readiness", async () => {
  const connection = createLocalConnection({ deferReady: true, mapName: "valley", nickname: "P1",
    colors: { primary: "yellow", secondary: "blue" }, loadout: ["cannon", "digger"],
    opponentColors: { primary: "cyan", secondary: "orange" }, opponentLoadout: ["triple", "laser"] });
  const messages: ServerMessage[] = [];
  connection.subscribe(message => messages.push(message));
  try {
    connection.send({ type: "match.ready" });
    await Promise.resolve();
    expect(messages.some(message => message.type === "match.finished")).toBe(false);
    connection.send({ type: "match.surrender" });
    await Promise.resolve();
    expect(messages.filter(message => message.type === "match.finished")).toHaveLength(1);
    expect(messages.find(message => message.type === "match.finished")).toMatchObject({ result: { reason: "surrender" } });
    connection.releaseReady();
    await Promise.resolve();
    expect(messages.filter(message => message.type === "match.finished")).toHaveLength(1);
  } finally { connection.close(); }
});
