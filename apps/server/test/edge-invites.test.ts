import { expect, it } from "vitest";
import { WebSocket } from "ws";
import { CLIENT_BUILD } from "@game/protocol/build";
const endpoint = process.env.EDGE_TEST_URL;
it.skipIf(!endpoint)("issues invitations only for participants and validates them before joining", async () => {
  const headers = { Origin: "http://127.0.0.1:5186" }, sockets: WebSocket[] = [];
  const connect = async (roomId: string) => {
    const ws = new WebSocket(`${endpoint!.replace("http", "ws")}/v2/rooms/${roomId}`, { headers }), messages: any[] = [];
    sockets.push(ws); ws.on("message", value => messages.push(JSON.parse(String(value))));
    await new Promise<void>((resolve, reject) => { ws.once("open", resolve); ws.once("error", reject); });
    return { ws, messages };
  };
  try {
    const { roomId } = await fetch(`${endpoint}/v2/rooms`, { method: "POST", headers }).then(r => r.json()) as { roomId: string };
    const owner = await connect(roomId), profile = { nickname: "Invite", loadout: ["cannon", "laser"] };
    owner.ws.send(JSON.stringify({ type: "room.create", build: CLIENT_BUILD, profile }));
    await expect.poll(() => owner.messages.find(m => m.type === "room.welcome")).toBeTruthy();
    const session = owner.messages.find(m => m.type === "room.welcome").token;
    expect((await fetch(`${endpoint}/v2/rooms/${roomId}/invite`, { method: "POST", headers })).status).toBe(403);
    const response = await fetch(`${endpoint}/v2/rooms/${roomId}/invite`, { method: "POST", headers: { ...headers, Authorization: `Bearer ${session}` } });
    expect(response.status).toBe(200);
    const invite = await response.json() as { token: string; expiresAt: number };
    expect(invite.token).not.toBe(session); expect(invite.expiresAt).toBeGreaterThan(Date.now());
    const invalid = await connect(roomId);
    invalid.ws.send(JSON.stringify({ type: "room.join", build: CLIENT_BUILD, roomId, profile, invite: "00000000-0000-4000-8000-000000000000" }));
    await expect.poll(() => invalid.messages.find(m => m.type === "room.error")?.reason).toBe("invalid-invite");
    expect(invalid.messages.some(m => m.type === "room.welcome")).toBe(false);
    const guest = await connect(roomId);
    guest.ws.send(JSON.stringify({ type: "room.join", build: CLIENT_BUILD, roomId, profile, invite: invite.token }));
    await expect.poll(() => guest.messages.some(m => m.type === "room.welcome")).toBe(true);
    const direct = await connect(roomId);
    direct.ws.send(JSON.stringify({ type: "room.join", build: CLIENT_BUILD, roomId, profile }));
    await expect.poll(() => direct.messages.some(m => m.type === "room.welcome")).toBe(true);
  } finally { sockets.forEach(ws => ws.close()); }
}, 20000);
