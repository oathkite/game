import { expect, it } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import { labOutputSchema, type LabOutput } from "@game/protocol/v2-lab";
import { attachMovementLab } from "../src/lab/movementWs";

it("broadcasts an authenticated move to 8 sockets and resumes without repeating it", async () => {
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1", maxPayload: 4096 });
  await new Promise<void>(resolve => wss.once("listening", resolve));
  const host = attachMovementLab(wss);
  const address = wss.address(); if (!address || typeof address === "string") throw new Error("address");
  const sockets: WebSocket[] = [], inboxes: LabOutput[][] = [];
  const connect = async (token?: string) => {
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}`), inbox: LabOutput[] = [];
    sockets.push(ws); inboxes.push(inbox);
    ws.on("message", data => inbox.push(labOutputSchema.parse(JSON.parse(data.toString()))));
    await new Promise<void>(resolve => ws.once("open", resolve));
    ws.send(JSON.stringify({ type: "lab.join", ...(token ? { token } : {}) }));
    await expect.poll(() => inbox.some(m => m.type === "lab.welcome")).toBe(true);
    return { ws, inbox };
  };
  try {
    for (let i = 0; i < 8; i++) await connect();
    const welcome = inboxes[0]!.find(m => m.type === "lab.welcome")!;
    if (welcome.type !== "lab.welcome") throw new Error("welcome");
    const frame = inboxes[0]!.find(m => m.type === "lab.frame")!;
    if (frame.type !== "lab.frame") throw new Error("frame");
    expect(frame.actorId).toBe(welcome.playerId);
    const command = { version: 2, type: "move.command", matchId: frame.matchId, turnId: frame.turnId, commandId: "move1", moveSeq: 1, direction: 1, steps: 1 };
    sockets[1]!.send(JSON.stringify(command));
    await expect.poll(() => inboxes[1]!.some(m => m.type === "lab.ack" && m.reason === "not-actor")).toBe(true);
    sockets[0]!.send(JSON.stringify(command));
    await expect.poll(() => inboxes.every(box => box.some(m => m.type === "lab.frame" && m.movement.ackMoveSeq === 1))).toBe(true);
    const x = frame.movement.x + 1;
    expect(inboxes.every(box => box.some(m => m.type === "lab.frame" && m.movement.x === x))).toBe(true);
    sockets[0]!.close();
    await new Promise<void>(resolve => sockets[0]!.once("close", resolve));
    const resumed = await connect(welcome.token);
    resumed.ws.send(JSON.stringify(command));
    await expect.poll(() => resumed.inbox.some(m => m.type === "lab.ack" && m.snapshot?.ackMoveSeq === 1)).toBe(true);
    expect(resumed.inbox.some(m => m.type === "lab.frame" && m.movement.x === x)).toBe(true);
  } finally {
    for (const ws of sockets) ws.terminate(); host.close();
    await new Promise<void>(resolve => wss.close(() => resolve()));
  }
});
