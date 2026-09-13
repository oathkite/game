export const resolveRoomUrl = async (
  initial: { readonly type: string; readonly roomId?: string; readonly mode?: string; readonly region?: string }, base: string, savedRoomId: string | null, request: typeof fetch = fetch,
): Promise<string> => {
  const url = new URL(base);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid room server");
  let roomId = initial.type === "room.resume" ? savedRoomId : initial.roomId;
  if (initial.type === "room.quick") {
    const response = await request(new URL("/v2/quick", url).href, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: initial.mode, region: initial.region }) });
    if (!response.ok) throw new Error("quick allocation failed");
    roomId = (await response.json() as { roomId?: string }).roomId;
  }
  if (initial.type === "room.create") {
    const response = await request(new URL("/v2/rooms", url).href, { method: "POST" });
    if (!response.ok) throw new Error("room allocation failed");
    roomId = (await response.json() as { roomId?: string }).roomId;
  }
  if (!roomId || !/^[A-F0-9]{6}$/.test(roomId)) throw new Error("missing room");
  url.pathname = `/v2/rooms/${roomId}`; url.search = ""; url.hash = "";
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
};
